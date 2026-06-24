import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { isCoreAuthConfigured, isDbConfigured, isGoogleConfigured } from "@/lib/config/env";
import { checkRateLimit, clientIpFromRequest } from "@/lib/security/rateLimit";

// Throttle credential sign-in attempts to blunt brute-force / credential
// stuffing against bcrypt-hashed passwords.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 5 * 60_000;

const dbConfigured = isDbConfigured();
const coreAuthConfigured = isCoreAuthConfigured();
const googleConfigured = isGoogleConfigured();
const devAdminEnabled = process.env.DEV_ADMIN_ENABLED === "true";
const useAdapter = coreAuthConfigured && dbConfigured;
// Credentials sign-in (email/password and dev-admin) requires the stateless JWT
// session strategy, so we use JWT everywhere while the adapter still persists
// users/accounts for OAuth (Google).
const sessionStrategy = "jwt" as const;

if (process.env.NODE_ENV === "production" && devAdminEnabled) {
  console.warn(
    "[auth] DEV_ADMIN_ENABLED is true in production. The hard-coded admin/admin login is active — unset DEV_ADMIN_ENABLED for production deployments.",
  );
}

const providers: NextAuthConfig["providers"] = [];

// Production email/password sign-in. Accounts are created via /api/auth/register
// (which stores a bcrypt hash); here we just verify credentials.
if (dbConfigured) {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) {
          return null;
        }

        const ip = request instanceof Request ? clientIpFromRequest(request) : "unknown";
        if (!checkRateLimit(`login:${email}|${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS).ok) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? user.email ?? "Member",
          email: user.email ?? email,
          image: user.image,
        };
      },
    }),
  );
}

// Dev-only admin shortcut, still gated behind DEV_ADMIN_ENABLED. Must be off in
// production.
if (devAdminEnabled) {
  providers.push(
    Credentials({
      id: "dev-admin",
      name: "Dev Admin",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!dbConfigured) {
          return null;
        }

        const username = typeof credentials?.username === "string" ? credentials.username : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (username !== "admin" || password !== "admin") {
          return null;
        }

        const admin = await prisma.user.upsert({
          where: { email: "admin@nashboard.local" },
          update: {
            name: "Admin",
            role: "ADMIN",
            emailVerified: new Date(),
          },
          create: {
            name: "Admin",
            email: "admin@nashboard.local",
            role: "ADMIN",
            emailVerified: new Date(),
          },
        });

        return {
          id: admin.id,
          name: admin.name ?? "Admin",
          email: admin.email ?? "admin@nashboard.local",
          image: admin.image,
        };
      },
    }),
  );
}

if (googleConfigured) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  );
}

const config: NextAuthConfig = {
  providers,
  ...(useAdapter ? { adapter: PrismaAdapter(prisma) } : {}),
  session: { strategy: sessionStrategy },
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? (typeof token.sub === "string" ? token.sub : "guest");
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

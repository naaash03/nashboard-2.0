import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db/prisma";
import { isCoreAuthConfigured, isDbConfigured, isGoogleConfigured } from "@/lib/config/env";

const dbConfigured = isDbConfigured();
const coreAuthConfigured = isCoreAuthConfigured();
const googleConfigured = isGoogleConfigured();
const devAdminEnabled = process.env.DEV_ADMIN_ENABLED === "true";
const useAdapter = !devAdminEnabled && coreAuthConfigured && dbConfigured;
const sessionStrategy: "jwt" | "database" = devAdminEnabled ? "jwt" : useAdapter ? "database" : "jwt";

const providers: NextAuthConfig["providers"] = [];

if (devAdminEnabled) {
  providers.push(
    Credentials({
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

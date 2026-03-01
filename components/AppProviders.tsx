"use client";

import { SessionProvider } from "next-auth/react";
import { AuthModeProvider } from "@/components/context/AuthModeContext";

export default function AppProviders({
  children,
  authConfigured,
}: {
  children: React.ReactNode;
  authConfigured: boolean;
}) {
  if (!authConfigured) {
    return <AuthModeProvider value={{ authConfigured: false }}>{children}</AuthModeProvider>;
  }

  return (
    <AuthModeProvider value={{ authConfigured: true }}>
      <SessionProvider>{children}</SessionProvider>
    </AuthModeProvider>
  );
}


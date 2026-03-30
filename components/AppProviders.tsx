"use client";

import { SessionProvider } from "next-auth/react";
import { ModeProvider } from "@/app/context/ModeContext";
import { StatExplainerProvider } from "@/app/context/StatExplainerContext";
import { AuthModeProvider } from "@/components/context/AuthModeContext";
import StatExplainerModal from "@/components/stats/StatExplainerModal";

function ProviderShell({ children }: { children: React.ReactNode }) {
  return (
    <ModeProvider>
      <StatExplainerProvider>
        {children}
        <StatExplainerModal />
      </StatExplainerProvider>
    </ModeProvider>
  );
}

export default function AppProviders({
  children,
  authConfigured,
}: {
  children: React.ReactNode;
  authConfigured: boolean;
}) {
  if (!authConfigured) {
    return (
      <AuthModeProvider value={{ authConfigured: false }}>
        <ProviderShell>{children}</ProviderShell>
      </AuthModeProvider>
    );
  }

  return (
    <AuthModeProvider value={{ authConfigured: true }}>
      <SessionProvider>
        <ProviderShell>{children}</ProviderShell>
      </SessionProvider>
    </AuthModeProvider>
  );
}

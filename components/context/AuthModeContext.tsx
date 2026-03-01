"use client";

import { createContext, useContext } from "react";

export type AuthModeContextValue = {
  authConfigured: boolean;
};

const AuthModeContext = createContext<AuthModeContextValue>({ authConfigured: false });

export function AuthModeProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AuthModeContextValue;
}) {
  return <AuthModeContext.Provider value={value}>{children}</AuthModeContext.Provider>;
}

export function useAuthMode() {
  return useContext(AuthModeContext);
}


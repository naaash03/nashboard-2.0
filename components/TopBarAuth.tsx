"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useAuthMode } from "@/components/context/AuthModeContext";

function AuthEnabledControls() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  if (session?.user) {
    return (
      <div className="flex items-center gap-3 text-xs text-neutral-200">
        <span>
          Signed in as <span className="font-semibold">{session.user.name ?? session.user.email}</span>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-full border border-neutral-600 px-3 py-1 hover:bg-neutral-800"
          disabled={isLoading}
          type="button"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-neutral-400">Guest mode: data resets each browser session.</span>
      <button
        onClick={() => signIn()}
        className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
        disabled={isLoading}
        type="button"
      >
        Sign in to save
      </button>
    </div>
  );
}

export default function TopBarAuth() {
  const { authConfigured } = useAuthMode();

  if (!authConfigured) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-300">
          Auth not configured. Set `DATABASE_URL` and `NEXTAUTH_*` env vars to enable sign-in.
        </span>
        <button
          className="rounded-full bg-neutral-200 px-3 py-1 text-[11px] font-semibold text-neutral-700 opacity-60"
          disabled
          type="button"
          title="Auth not configured. Set env vars to enable sign-in."
        >
          Sign in to save
        </button>
      </div>
    );
  }

  return <AuthEnabledControls />;
}


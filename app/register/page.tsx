"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not create your account.");
        setSubmitting(false);
        return;
      }

      // Account created — sign the new user in immediately.
      const result = await signIn("credentials", { email, password, redirect: false });
      setSubmitting(false);
      if (result?.error) {
        setError("Account created, but automatic sign-in failed. Please sign in.");
        router.push("/signin");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (caught) {
      setSubmitting(false);
      setError(`Something went wrong: ${String(caught)}`);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12 text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-neutral-400">Save your dashboard and pick up where you left off.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-neutral-400">Name (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-400">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-400">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2"
            autoComplete="new-password"
          />
          <span className="mt-1 block text-[11px] text-neutral-500">At least 8 characters.</span>
        </label>

        {error ? <p className="text-sm text-amber-300">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-white disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void signIn("google", { callbackUrl: "/" })}
        className="w-full rounded border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
      >
        Continue with Google
      </button>

      <p className="text-sm text-neutral-400">
        Already have an account?{" "}
        <Link href="/signin" className="text-neutral-100 underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

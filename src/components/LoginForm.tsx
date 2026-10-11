"use client";

import { useActionState } from "react";
import { authentikLoginAction, loginAction } from "@/app/admin/actions";

export function LoginForm({
  callbackUrl = "/",
  authentikEnabled = false,
}: {
  callbackUrl?: string;
  authentikEnabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="space-y-6">
      {authentikEnabled ? (
        <form action={authentikLoginAction}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            className="w-full rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300"
          >
            Sign in with Authentik
          </button>
        </form>
      ) : null}

      {authentikEnabled ? (
        <div className="flex items-center gap-3 text-xs tracking-wide text-zinc-500 uppercase">
          <span className="h-px flex-1 bg-zinc-800" />
          or
          <span className="h-px flex-1 bg-zinc-800" />
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label className="block text-sm text-zinc-300">
          Email or username
          <input
            name="email"
            type="text"
            required
            autoComplete="username"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className={
            authentikEnabled
              ? "w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 disabled:opacity-60"
              : "w-full rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
          }
        >
          {pending ? "Signing in…" : authentikEnabled ? "Sign in with password" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

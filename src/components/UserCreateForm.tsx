"use client";

import { useActionState } from "react";
import { createUserAction } from "@/app/admin/users/actions";

export function UserCreateForm() {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-300">
          Username
          <input
            name="username"
            required
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Group
          <select
            name="role"
            defaultValue="user"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          >
            <option value="user">User</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input name="notifyNewMovies" type="checkbox" className="accent-amber-400" />
        Notify this user by email when new movies are added
      </label>
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input
          name="sendSiteGuide"
          type="checkbox"
          defaultChecked
          className="mt-0.5 accent-amber-400"
        />
        <span>
          Email a site guide matching their group (user or administrator). It covers catalog, lists,
          and — for admins — scanning, library, and accounts.
        </span>
      </label>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? (
        <p className="text-sm text-emerald-400">
          {state.warning ?? "User created. A welcome email was sent."}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { clearLibraryAction } from "@/app/admin/actions";

export function DatabaseTools() {
  const [state, formAction, pending] = useActionState(clearLibraryAction, undefined);

  return (
    <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">Database</h2>
      <p className="mt-2 mb-4 text-sm text-zinc-400">
        Download a SQL backup, or wipe movies, files, folders, and scan history. The admin login
        and TMDB API key are kept. Files on disk are never deleted.
      </p>

      <a
        href="/api/admin/backup"
        className="inline-flex rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400"
      >
        Download backup
      </a>

      <form action={formAction} className="mt-6 space-y-3 border-t border-zinc-800 pt-6">
        <p className="text-sm text-zinc-400">
          Type <span className="font-mono text-zinc-200">CLEAR</span> to empty the library.
        </p>
        <label className="block text-sm text-zinc-300">
          Confirm
          <input
            name="confirm"
            autoComplete="off"
            placeholder="CLEAR"
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
        {state?.ok ? <p className="text-sm text-emerald-400">Library cleared.</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 hover:border-red-500 disabled:opacity-60"
        >
          {pending ? "Clearing…" : "Clear database"}
        </button>
      </form>
    </section>
  );
}

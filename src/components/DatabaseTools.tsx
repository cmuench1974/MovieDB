"use client";

import { useActionState } from "react";
import { clearLibraryAction, restoreLibraryAction } from "@/app/admin/actions";

export function DatabaseTools() {
  const [clearState, clearAction, clearPending] = useActionState(clearLibraryAction, undefined);
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreLibraryAction,
    undefined,
  );

  return (
    <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">Database</h2>
      <p className="mt-2 mb-4 text-sm text-zinc-400">
        Download a SQL backup, restore one, or wipe movies, files, folders, and scan history.
        Restore replaces the whole database (including users and settings). Files on disk are never
        deleted.
      </p>

      <a
        href="/api/admin/backup"
        className="inline-flex rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400"
      >
        Download backup
      </a>

      <form action={restoreAction} className="mt-6 space-y-3 border-t border-zinc-800 pt-6">
        <p className="text-sm text-zinc-400">
          Restore a <span className="font-mono text-zinc-200">.sql</span> file from Download
          backup. Type <span className="font-mono text-zinc-200">RESTORE</span> to confirm. This
          overwrites the current database.
        </p>
        <label className="block text-sm text-zinc-300">
          Backup file
          <input
            name="backup"
            type="file"
            accept=".sql,text/plain,application/sql"
            required
            className="mt-1 block w-full max-w-md text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border file:border-zinc-700 file:bg-zinc-950 file:px-3 file:py-1.5 file:text-zinc-200"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Confirm
          <input
            name="confirm"
            autoComplete="off"
            placeholder="RESTORE"
            className="mt-1 w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        {restoreState?.error ? <p className="text-sm text-red-400">{restoreState.error}</p> : null}
        {restoreState?.ok ? (
          <p className="text-sm text-emerald-400">Database restored from backup.</p>
        ) : null}
        <button
          type="submit"
          disabled={restorePending}
          className="rounded-lg border border-amber-800 px-4 py-2 text-sm text-amber-200 hover:border-amber-400 disabled:opacity-60"
        >
          {restorePending ? "Restoring…" : "Restore backup"}
        </button>
      </form>

      <form action={clearAction} className="mt-6 space-y-3 border-t border-zinc-800 pt-6">
        <p className="text-sm text-zinc-400">
          Type <span className="font-mono text-zinc-200">CLEAR</span> to empty the library. The
          admin login and TMDB API key are kept.
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
        {clearState?.error ? <p className="text-sm text-red-400">{clearState.error}</p> : null}
        {clearState?.ok ? <p className="text-sm text-emerald-400">Library cleared.</p> : null}
        <button
          type="submit"
          disabled={clearPending}
          className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 hover:border-red-500 disabled:opacity-60"
        >
          {clearPending ? "Clearing…" : "Clear database"}
        </button>
      </form>
    </section>
  );
}

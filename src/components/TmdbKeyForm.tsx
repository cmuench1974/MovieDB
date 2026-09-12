"use client";

import { useActionState } from "react";
import { clearTmdbKeyAction, saveTmdbKeyAction } from "@/app/admin/actions";

export function TmdbKeyForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(saveTmdbKeyAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm text-zinc-300">
        API key
        <input
          name="tmdbApiKey"
          type="text"
          autoComplete="off"
          spellCheck={false}
          required
          placeholder={configured ? "Enter a new key to replace the saved one" : "Paste your TMDB v3 API key"}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
        />
      </label>
      <p className="text-xs text-zinc-500">
        Create a free key at{" "}
        <a
          href="https://www.themoviedb.org/settings/api"
          className="text-amber-400 hover:text-amber-300"
          target="_blank"
          rel="noreferrer"
        >
          themoviedb.org/settings/api
        </a>
        . It is stored encrypted and never shown again.{" "}
        {configured ? "A key is already saved — paste a new one to replace it." : "No key saved yet."}
      </p>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-400">TMDB key saved.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Save key"}
        </button>
        {configured ? (
          <button
            type="submit"
            formAction={clearTmdbKeyAction}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Remove key
          </button>
        ) : null}
      </div>
    </form>
  );
}

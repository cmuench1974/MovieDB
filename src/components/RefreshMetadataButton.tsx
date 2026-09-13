"use client";

import { useState, useTransition } from "react";
import { refreshMovieMetadataAction } from "@/app/admin/actions";

export function RefreshMetadataButton({ movieId }: { movieId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setOk(false);
          startTransition(async () => {
            const result = await refreshMovieMetadataAction(movieId);
            if (result.error) setError(result.error);
            else setOk(true);
          });
        }}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-400 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update metadata"}
      </button>
      {ok ? (
        <p className="text-xs text-emerald-400">
          Title, overview, cast, and genres were refreshed from TMDB. Poster and backdrop were kept.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

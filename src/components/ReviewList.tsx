"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ignoreVideoFile, matchByTmdbId, matchByUrl } from "@/app/admin/actions";
import { PosterImage } from "./PosterImage";
import type { TmdbCandidate } from "@/lib/tmdb";

export type ReviewFile = {
  id: string;
  filename: string;
  parsedTitle: string | null;
  parsedYear: number | null;
  candidates: TmdbCandidate[];
};

export function ReviewList({ files }: { files: ReviewFile[] }) {
  const [activeId, setActiveId] = useState<string | null>(
    files[0]?.id ?? null,
  );

  if (files.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
        Nothing to review. Run a scan first, or all files are already matched.
      </p>
    );
  }

  const active = files.find((file) => file.id === activeId) ?? files[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <ul className="space-y-1">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              onClick={() => setActiveId(file.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                file.id === active.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span className="block truncate">{file.filename}</span>
              <span className="text-xs text-zinc-500">
                {file.parsedTitle || "Unknown title"}
                {file.parsedYear ? ` (${file.parsedYear})` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <MatchDialog key={active.id} file={active} />
    </div>
  );
}

function MatchDialog({ file }: { file: ReviewFile }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectCandidate(tmdbId: number) {
    setError(null);
    startTransition(async () => {
      try {
        await matchByTmdbId(file.id, tmdbId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save match.");
      }
    });
  }

  function submitUrl(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await matchByUrl(file.id, url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save match.");
      }
    });
  }

  function ignore() {
    setError(null);
    startTransition(async () => {
      await ignoreVideoFile(file.id);
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium text-zinc-100">{file.filename}</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Parsed as{" "}
        <span className="text-zinc-200">
          {file.parsedTitle || "unknown"}
          {file.parsedYear ? ` (${file.parsedYear})` : ""}
        </span>
      </p>

      <h3 className="mt-6 text-sm font-medium uppercase tracking-wide text-zinc-500">
        TMDB matches
      </h3>
      {file.candidates.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No automatic suggestions. Paste a TMDB URL below.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {file.candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => selectCandidate(candidate.id)}
                className="flex w-full gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-left hover:border-amber-400 disabled:opacity-60"
              >
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-zinc-800">
                  <PosterImage
                    path={candidate.poster_path}
                    alt={candidate.title}
                    size="w185"
                  />
                </div>
                <span>
                  <span className="block text-sm font-medium text-zinc-100">
                    {candidate.title}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {candidate.release_date?.slice(0, 4) || "Unknown year"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submitUrl} className="mt-6 space-y-2">
        <label htmlFor="tmdb-url" className="text-sm font-medium text-zinc-300">
          Or paste a TMDB movie URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="tmdb-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.themoviedb.org/movie/603-the-matrix"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={pending || !url.trim()}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
          >
            Use URL
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={ignore}
        disabled={pending}
        className="mt-4 text-sm text-zinc-500 hover:text-zinc-300"
      >
        Ignore this file
      </button>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {pending ? <p className="mt-3 text-sm text-zinc-500">Saving…</p> : null}
    </section>
  );
}

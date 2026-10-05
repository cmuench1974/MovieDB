"use client";

import { useState, useTransition } from "react";
import {
  attachFileToMovieAction,
  deleteMovieAction,
  searchMoviesForAttachAction,
} from "@/app/admin/actions";

type UnmatchedFile = {
  id: string;
  filename: string;
  status: string;
  parsedTitle: string | null;
  parsedYear: number | null;
};

type OrphanMovie = {
  id: string;
  title: string;
  year: number | null;
};

type MovieHit = {
  id: string;
  title: string;
  year: number | null;
  _count: { videoFiles: number };
};

export function AttachFileToMovie({ file }: { file: UnmatchedFile }) {
  const [query, setQuery] = useState(file.parsedTitle ?? "");
  const [hits, setHits] = useState<MovieHit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    setError(null);
    startTransition(async () => {
      const results = await searchMoviesForAttachAction(query);
      setHits(results);
      if (results.length === 0) setError("No matching titles in the library.");
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search library titles…"
          className="min-w-48 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
        />
        <button
          type="button"
          disabled={pending || query.trim().length < 2}
          onClick={search}
          className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-100 hover:border-amber-400 disabled:opacity-60"
        >
          {pending ? "Searching…" : "Find movie"}
        </button>
      </div>
      {hits.length > 0 ? (
        <ul className="space-y-1">
          {hits.map((movie) => (
            <li key={movie.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-300">
                {movie.title}
                {movie.year ? ` (${movie.year})` : ""}
                <span className="ml-2 text-xs text-zinc-500">
                  {movie._count.videoFiles} {movie._count.videoFiles === 1 ? "file" : "files"}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await attachFileToMovieAction(file.id, movie.id);
                    if (result.ok) {
                      setMessage(`Linked to ${movie.title}.`);
                      setHits([]);
                    } else {
                      setError(result.error ?? "Could not link the file.");
                    }
                  });
                }}
                className="text-amber-400 hover:text-amber-300"
              >
                Assign
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
    </div>
  );
}

export function OrphanMovieActions({
  movie,
  unmatchedFiles,
}: {
  movie: OrphanMovie;
  unmatchedFiles: UnmatchedFile[];
}) {
  const [fileId, setFileId] = useState(unmatchedFiles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      {unmatchedFiles.length > 0 ? (
        <>
          <label className="block text-xs text-zinc-400">
            Attach file
            <select
              value={fileId}
              onChange={(event) => setFileId(event.target.value)}
              className="mt-1 block min-w-56 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
            >
              {unmatchedFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.filename}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !fileId}
            onClick={() => {
              startTransition(async () => {
                const result = await attachFileToMovieAction(fileId, movie.id);
                if (!result.ok) setError(result.error ?? "Could not attach the file.");
              });
            }}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-100 hover:border-amber-400 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Attach"}
          </button>
        </>
      ) : (
        <p className="text-xs text-zinc-500">No unattached files to point this title at.</p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Remove “${movie.title}” from the database? Files on disk are not deleted.`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            await deleteMovieAction(movie.id);
          });
        }}
        className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300 hover:border-red-500 disabled:opacity-60"
      >
        Remove movie
      </button>
      {error ? <p className="w-full text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

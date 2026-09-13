"use client";

import { useActionState } from "react";
import { updateMovieAction } from "@/app/admin/actions";
import type { MovieVersionView } from "@/lib/movie-view";

type EditMovieFormProps = {
  movieId: string;
  tmdbId: number;
  fileId: string | null;
  title: string;
  year: number | null;
  overview: string | null;
  version: MovieVersionView | null;
  versionCount: number;
};

export function EditMovieForm({
  movieId,
  tmdbId,
  fileId,
  title,
  year,
  overview,
  version,
  versionCount,
}: EditMovieFormProps) {
  const action = updateMovieAction.bind(null, movieId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form key={fileId ?? "movie"} action={formAction} className="space-y-4">
      {fileId ? <input type="hidden" name="fileId" value={fileId} /> : null}
      {versionCount > 1 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
          Saving updates only the selected version ({version?.label}). Poster and cast stay shared.
          Pasting a different TMDB URL moves this version onto that title.
        </p>
      ) : null}
      <label className="block text-sm text-zinc-300">
        Title
        <input
          key={`${fileId}-title`}
          name="title"
          required
          defaultValue={title}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Year
        <input
          key={`${fileId}-year`}
          name="year"
          defaultValue={year ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Overview
        <textarea
          key={`${fileId}-overview`}
          name="overview"
          rows={6}
          defaultValue={overview ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Replace from TMDB URL (optional)
        <input
          name="tmdb"
          placeholder={`Current TMDB id ${tmdbId}, or paste a movie URL`}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      {version ? (
        <dl className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-400">
          <div>Runtime: {version.runtimeLabel ?? "Unknown"}</div>
          <div>
            Format: {[version.resolutionLabel, version.hdrFormat, version.pixelLabel]
              .filter(Boolean)
              .join(" · ") || "Unknown"}
          </div>
          <div>Audio: {version.audioLabels.join(", ") || "None detected"}</div>
          <div>Subtitles: {version.subtitleLabels.join(", ") || "None detected"}</div>
          <div>
            File: {version.filename} · {version.sizeLabel}
          </div>
          {version.probeError ? (
            <div className="text-amber-400">{version.probeError}</div>
          ) : null}
        </dl>
      ) : null}
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-400">Saved.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateMovieAction } from "@/app/admin/actions";

type MovieEdit = {
  id: string;
  title: string;
  year: number | null;
  overview: string | null;
  tmdbId: number;
};

export function EditMovieForm({ movie }: { movie: MovieEdit }) {
  const action = updateMovieAction.bind(null, movie.id);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => {
      try {
        await action(formData);
        return { ok: true };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Could not save movie." };
      }
    },
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm text-zinc-300">
        Title
        <input
          name="title"
          required
          defaultValue={movie.title}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Year
        <input
          name="year"
          defaultValue={movie.year ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Overview
        <textarea
          name="overview"
          rows={6}
          defaultValue={movie.overview ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Replace from TMDB URL (optional)
        <input
          name="tmdb"
          placeholder={`Current TMDB id ${movie.tmdbId}, or paste a movie URL`}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
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

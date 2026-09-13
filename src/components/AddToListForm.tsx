"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addMovieToListAction } from "@/app/lists/actions";

export function AddToListForm({
  movieId,
  lists,
}: {
  movieId: string;
  lists: { id: string; name: string }[];
}) {
  const bound = addMovieToListAction.bind(null, movieId);
  const [state, formAction, pending] = useActionState(bound, undefined);

  if (lists.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-400">
        <Link href="/lists/new" className="text-amber-400 hover:text-amber-300">
          Create a list
        </Link>{" "}
        to save this title.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-wrap items-end gap-2">
      <label className="block text-sm text-zinc-300">
        Add to list
        <select
          name="listId"
          required
          className="mt-1 block min-w-48 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-400 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error ? <p className="w-full text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-emerald-400">Added to the list.</p> : null}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { addMovieToListAction, createListAction } from "@/app/lists/actions";

const NEW_LIST = "__new__";

const fieldClass =
  "mt-1 block min-w-48 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400";

export function AddToListForm({
  movieId,
  lists,
}: {
  movieId: string;
  lists: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState(lists[0]?.id ?? NEW_LIST);
  const creating = selected === NEW_LIST;

  const addBound = addMovieToListAction.bind(null, movieId);
  const createBound = createListAction.bind(null, movieId);
  const [addState, addAction, addPending] = useActionState(addBound, undefined);
  const [createState, createAction, createPending] = useActionState(
    createBound,
    undefined,
  );

  const pending = creating ? createPending : addPending;
  const error = creating ? createState?.error : addState?.error;
  const added = !creating && addState?.ok;

  return (
    <form
      action={creating ? createAction : addAction}
      className="mt-6 flex flex-wrap items-end gap-2"
    >
      {creating ? null : <input type="hidden" name="listId" value={selected} />}
      <label className="block text-sm text-zinc-300">
        Add to list
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={fieldClass}
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
          <option value={NEW_LIST}>New list</option>
        </select>
      </label>
      {creating ? (
        <label className="block text-sm text-zinc-300">
          Name
          <input name="name" required autoComplete="off" className={fieldClass} />
        </label>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-400 disabled:opacity-60"
      >
        {creating
          ? pending
            ? "Saving…"
            : "Create list"
          : pending
            ? "Adding…"
            : "Add"}
      </button>
      {error ? <p className="w-full text-sm text-red-400">{error}</p> : null}
      {added ? <p className="w-full text-sm text-emerald-400">Added to the list.</p> : null}
    </form>
  );
}

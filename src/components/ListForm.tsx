"use client";

import { useActionState } from "react";
import { createListAction, updateListAction } from "@/app/lists/actions";

type DirectoryUser = { id: string; username: string };

type ListValues = {
  id: string;
  name: string;
  comment: string | null;
  sharedUserIds: string[];
};

export function ListForm({
  users,
  list,
}: {
  users: DirectoryUser[];
  list?: ListValues;
}) {
  const action = list ? updateListAction.bind(null, list.id) : createListAction;
  const [state, formAction, pending] = useActionState(
    action as (
      prev: { error?: string; ok?: boolean } | undefined,
      formData: FormData,
    ) => Promise<{ error?: string; ok?: boolean } | undefined>,
    undefined,
  );
  const selected = new Set(list?.sharedUserIds ?? []);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm text-zinc-300">
        Name
        <input
          name="name"
          required
          defaultValue={list?.name ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
        />
      </label>
      <label className="block text-sm text-zinc-300">
        Comment
        <textarea
          name="comment"
          maxLength={3000}
          rows={6}
          defaultValue={list?.comment ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
        />
        <span className="mt-1 block text-xs text-zinc-500">Up to 3000 characters.</span>
      </label>
      <fieldset>
        <legend className="text-sm text-zinc-300">Visible to</legend>
        <p className="mt-1 mb-3 text-xs text-zinc-500">
          Always visible to you. Optionally share with other accounts.
        </p>
        {users.length === 0 ? (
          <p className="text-sm text-zinc-500">No other users to share with yet.</p>
        ) : (
          <ul className="space-y-2">
            {users.map((user) => (
              <li key={user.id}>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    name="sharedUserIds"
                    value={user.id}
                    defaultChecked={selected.has(user.id)}
                    className="accent-amber-400"
                  />
                  {user.username}
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {state && "error" in state && state.error ? (
        <p className="text-sm text-red-400">{state.error}</p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p className="text-sm text-emerald-400">List saved.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
      >
        {pending ? "Saving…" : list ? "Save list" : "Create list"}
      </button>
    </form>
  );
}

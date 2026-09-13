"use client";

import { useActionState } from "react";
import { updateUserAction } from "@/app/admin/users/actions";
import { deleteUserAction } from "@/app/admin/users/actions";

type EditableUser = {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  notifyNewMovies: boolean;
};

export function UserEditForm({
  user,
  canDelete,
}: {
  user: EditableUser;
  canDelete: boolean;
}) {
  const boundUpdate = updateUserAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState(boundUpdate, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-zinc-300">
          Username
          <input
            name="username"
            required
            defaultValue={user.username}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue={user.email}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          New password
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Leave blank to keep the current password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Group
          <select
            name="role"
            defaultValue={user.role}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          >
            <option value="user">User</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          name="notifyNewMovies"
          type="checkbox"
          defaultChecked={user.notifyNewMovies}
          className="accent-amber-400"
        />
        Notify this user by email when new movies are added
      </label>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-400">User saved.</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save user"}
        </button>
        {canDelete ? (
          <button
            type="submit"
            formAction={deleteUserAction.bind(null, user.id)}
            onClick={(event) => {
              if (!confirm(`Delete ${user.username}? Their lists will be removed.`)) {
                event.preventDefault();
              }
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-red-300 hover:border-red-400"
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}

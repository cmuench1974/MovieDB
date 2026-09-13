"use client";

import { useActionState } from "react";
import {
  deleteOwnAccountAction,
  updateCredentialsAction,
  updateNotificationsAction,
} from "@/app/account/actions";

type AccountUser = {
  username: string;
  email: string;
  role: "admin" | "user";
  notifyNewMovies: boolean;
};

export function AccountSettingsForm({ user }: { user: AccountUser }) {
  const [notifyState, notifyAction, notifyPending] = useActionState(
    updateNotificationsAction,
    undefined,
  );
  const [credState, credAction, credPending] = useActionState(updateCredentialsAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteOwnAccountAction,
    undefined,
  );

  return (
    <div className="space-y-10">
      <form action={notifyAction} className="space-y-4">
        <h2 className="text-lg font-medium">Email notifications</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            name="notifyNewMovies"
            type="checkbox"
            defaultChecked={user.notifyNewMovies}
            className="accent-amber-400"
          />
          Email me when new movies are added to the catalog
        </label>
        {notifyState?.error ? <p className="text-sm text-red-400">{notifyState.error}</p> : null}
        {notifyState?.ok ? (
          <p className="text-sm text-emerald-400">Notification settings saved.</p>
        ) : null}
        <button
          type="submit"
          disabled={notifyPending}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {notifyPending ? "Saving…" : "Save notifications"}
        </button>
      </form>

      <form action={credAction} className="space-y-4 border-t border-zinc-800 pt-8">
        <h2 className="text-lg font-medium">Email and password</h2>
        <p className="text-sm text-zinc-400">
          Username is <span className="font-medium text-zinc-200">{user.username}</span> and can
          only be changed by an administrator. Changing the password signs you out.
        </p>
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
          Current password
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          New password
          <input
            name="newPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Leave blank to keep the current password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
        </label>
        {credState?.error ? <p className="text-sm text-red-400">{credState.error}</p> : null}
        {credState?.ok ? <p className="text-sm text-emerald-400">Account details saved.</p> : null}
        <button
          type="submit"
          disabled={credPending}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {credPending ? "Saving…" : "Save email and password"}
        </button>
      </form>

      <form action={deleteAction} className="space-y-4 border-t border-zinc-800 pt-8">
        <h2 className="text-lg font-medium text-red-300">Delete account</h2>
        <p className="text-sm text-zinc-400">
          This removes your account and your lists. The catalog stays. Type{" "}
          <span className="font-mono text-zinc-200">DELETE</span> and your current password.
          {user.role === "admin"
            ? " The last administrator cannot be deleted."
            : null}
        </p>
        <label className="block text-sm text-zinc-300">
          Confirm
          <input
            name="confirm"
            autoComplete="off"
            placeholder="DELETE"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          Current password
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          />
        </label>
        {deleteState?.error ? <p className="text-sm text-red-400">{deleteState.error}</p> : null}
        <button
          type="submit"
          disabled={deletePending}
          className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 hover:border-red-500 disabled:opacity-60"
        >
          {deletePending ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </div>
  );
}

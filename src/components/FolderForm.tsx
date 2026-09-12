"use client";

import { useActionState, useState, type ReactNode } from "react";
import { addFolderAction } from "@/app/admin/actions";

export function FolderForm() {
  const [kind, setKind] = useState<"local" | "smb">("local");
  const [state, formAction, pending] = useActionState(addFolderAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex gap-2">
        <KindButton selected={kind === "local"} onClick={() => setKind("local")}>
          Local / NFS
        </KindButton>
        <KindButton selected={kind === "smb"} onClick={() => setKind("smb")}>
          SMB share
        </KindButton>
      </div>
      <input type="hidden" name="kind" value={kind} />

      <Field label="Name" name="label" placeholder="Living room NAS" required />

      {kind === "local" ? (
        <>
          <Field
            label="Path inside the container"
            name="path"
            placeholder="/media/movies"
            required
          />
          <p className="text-xs text-zinc-500">
            NFS and host folders must already be mounted into the container (for example via{" "}
            <code>MEDIA_PATH</code> at <code>/media</code>).
          </p>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Host" name="smbHost" placeholder="192.168.1.10 or nas.local" required />
          <Field label="Share" name="smbShare" placeholder="movies" required />
          <Field label="Subfolder (optional)" name="smbFolder" placeholder="4k" />
          <Field label="Domain (optional)" name="smbDomain" placeholder="WORKGROUP" />
          <Field label="Username" name="smbUsername" />
          <label className="block text-sm text-zinc-300">
            Password
            <input
              name="smbPassword"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
            />
          </label>
          <p className="sm:col-span-2 text-xs text-zinc-500">
            Use the NAS name or LAN IP. Share is only the share name (media), not a UNC path.
            If the share is already mapped on this Windows PC (for example Y: → \\JUPITER\media),
            username and password can stay empty. Otherwise fill them in.
          </p>
        </div>
      )}

      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Add folder"}
      </button>
    </form>
  );
}

function KindButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm ${
        selected ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
      />
    </label>
  );
}

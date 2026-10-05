"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { addFolderAction, testFolderAction, updateFolderAction } from "@/app/admin/actions";

export type FolderFormValues = {
  id: string;
  label: string;
  kind: "local" | "smb";
  path: string | null;
  smbHost: string | null;
  smbShare: string | null;
  smbFolder: string | null;
  smbDomain: string | null;
  smbUsername: string | null;
};

export function FolderForm({
  folder,
  onSaved,
}: {
  folder?: FolderFormValues;
  onSaved?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<"local" | "smb">(folder?.kind ?? "local");
  const saveAction = folder ? updateFolderAction.bind(null, folder.id) : addFolderAction;
  const [state, formAction, pending] = useActionState(saveAction, undefined);
  const [testState, setTestState] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [testing, startTest] = useTransition();
  const editing = Boolean(folder);

  useEffect(() => {
    if (state && "ok" in state && state.ok) onSaved?.();
  }, [state, onSaved]);

  function runTest() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    startTest(async () => {
      const result = await testFolderAction(undefined, formData);
      setTestState(result);
    });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {folder ? <input type="hidden" name="folderId" value={folder.id} /> : null}
      {editing ? (
        <input type="hidden" name="kind" value={kind} />
      ) : (
        <>
          <div className="flex gap-2">
            <KindButton selected={kind === "local"} onClick={() => setKind("local")}>
              Local / NFS
            </KindButton>
            <KindButton selected={kind === "smb"} onClick={() => setKind("smb")}>
              SMB share
            </KindButton>
          </div>
          <input type="hidden" name="kind" value={kind} />
        </>
      )}

      <Field
        label="Name"
        name="label"
        placeholder="Living room NAS"
        required
        defaultValue={folder?.label}
      />

      {kind === "local" ? (
        <>
          <Field
            label="Path inside the container"
            name="path"
            placeholder="/media/movies"
            required
            defaultValue={folder?.path ?? ""}
          />
          <p className="text-xs text-zinc-500">
            NFS and host folders must already be mounted into the container (for example via{" "}
            <code>MEDIA_PATH</code> at <code>/media</code>).
          </p>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Host"
            name="smbHost"
            placeholder="192.168.1.10 or nas.local"
            required
            defaultValue={folder?.smbHost ?? ""}
          />
          <Field
            label="Share"
            name="smbShare"
            placeholder="movies"
            required
            defaultValue={folder?.smbShare ?? ""}
          />
          <Field
            label="Subfolder (optional)"
            name="smbFolder"
            placeholder="4k"
            defaultValue={folder?.smbFolder ?? ""}
          />
          <Field
            label="Domain (optional)"
            name="smbDomain"
            placeholder="WORKGROUP"
            defaultValue={folder?.smbDomain ?? ""}
          />
          <Field label="Username" name="smbUsername" defaultValue={folder?.smbUsername ?? ""} />
          <label className="block text-sm text-zinc-300">
            Password
            <input
              name="smbPassword"
              type="password"
              autoComplete="new-password"
              placeholder={editing ? "Leave blank to keep the saved password" : undefined}
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
      {state && "ok" in state && state.ok ? (
        <p className="text-sm text-emerald-400">Folder saved.</p>
      ) : null}
      {testState?.error ? <p className="text-sm text-red-400">{testState.error}</p> : null}
      {testState?.ok ? <p className="text-sm text-emerald-400">Connection succeeded.</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {pending ? "Checking…" : editing ? "Save folder" : "Add folder"}
        </button>
        <button
          type="button"
          disabled={testing || pending}
          onClick={runTest}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400 disabled:opacity-60"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>
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
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm text-zinc-300">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
      />
    </label>
  );
}

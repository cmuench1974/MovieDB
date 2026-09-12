"use client";

import { useTransition } from "react";
import { removeFolderAction } from "@/app/admin/actions";

type FolderRow = {
  id: string;
  label: string;
  kind: "local" | "smb";
  path: string | null;
  smbHost: string | null;
  smbShare: string | null;
  smbFolder: string | null;
  lastError: string | null;
};

export function FolderList({ folders }: { folders: FolderRow[] }) {
  const [pending, startTransition] = useTransition();

  if (folders.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No folders yet. Add a local/NFS mount or an SMB share below.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
      {folders.map((folder) => (
        <li key={folder.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">{folder.label}</p>
            <p className="text-xs text-zinc-500">{describeFolder(folder)}</p>
            {folder.lastError ? (
              <p className="mt-1 text-xs text-red-400">{folder.lastError}</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  `Remove “${folder.label}” from the scan list? Video files from this folder are dropped from the library; files on disk are not deleted.`,
                )
              ) {
                return;
              }
              startTransition(async () => {
                await removeFolderAction(folder.id);
              });
            }}
            className="text-sm text-zinc-400 hover:text-red-400"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function describeFolder(folder: FolderRow): string {
  if (folder.kind === "local") return folder.path ?? "Local folder";
  const sub = folder.smbFolder ? `/${folder.smbFolder}` : "";
  return `smb://${folder.smbHost}/${folder.smbShare}${sub}`;
}

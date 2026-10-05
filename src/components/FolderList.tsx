"use client";

import { useState, useTransition } from "react";
import { removeFolderAction, testStoredFolderAction } from "@/app/admin/actions";
import { FolderForm, type FolderFormValues } from "./FolderForm";

type FolderRow = FolderFormValues & {
  lastError: string | null;
};

export function FolderList({ folders }: { folders: FolderRow[] }) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<{ id: string; ok: boolean; text: string } | null>(
    null,
  );

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
        <li key={folder.id} className="px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">{folder.label}</p>
              <p className="text-xs text-zinc-500">{describeFolder(folder)}</p>
              {folder.lastError ? (
                <p className="mt-1 text-xs text-red-400">{folder.lastError}</p>
              ) : null}
              {testMessage?.id === folder.id ? (
                <p className={`mt-1 text-xs ${testMessage.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {testMessage.text}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await testStoredFolderAction(folder.id);
                    setTestMessage({
                      id: folder.id,
                      ok: Boolean(result.ok),
                      text: result.ok
                        ? "Connection succeeded."
                        : (result.error ?? "Could not reach the folder."),
                    });
                  });
                }}
                className="text-sm text-zinc-400 hover:text-amber-300"
              >
                Test
              </button>
              <button
                type="button"
                onClick={() => setEditingId(editingId === folder.id ? null : folder.id)}
                className="text-sm text-zinc-400 hover:text-amber-300"
              >
                {editingId === folder.id ? "Close" : "Edit"}
              </button>
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
            </div>
          </div>
          {editingId === folder.id ? (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <FolderForm folder={folder} onSaved={() => setEditingId(null)} />
            </div>
          ) : null}
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

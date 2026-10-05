"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { importFileAction, listFolderBrowserAction } from "@/app/admin/actions";

export type AddFileFolder = {
  id: string;
  label: string;
  kind: "local" | "smb";
  path: string | null;
  smbHost: string | null;
  smbShare: string | null;
  smbFolder: string | null;
};

type BrowserEntry = {
  name: string;
  isDirectory: boolean;
  importPath: string | null;
};

export function AddFileForm({
  folders,
  tmdbConfigured,
}: {
  folders: AddFileFolder[];
  tmdbConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(importFileAction, undefined);
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [pathValue, setPathValue] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const selected = folders.find((folder) => folder.id === folderId) ?? folders[0];
  const placeholder = selected
    ? examplePath(selected)
    : "smb://192.168.1.10/media/movies/The Matrix (1999).mkv";

  if (folders.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Add a scan folder under Settings before importing a file by path.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {folders.length > 1 ? (
        <label className="block text-sm text-zinc-300">
          Folder
          <select
            name="folderId"
            required
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label} — {describeFolder(folder)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="folderId" value={folders[0].id} />
      )}

      <label className="block text-sm text-zinc-300">
        File path
        <div className="mt-1 flex gap-2">
          <input
            name="path"
            required
            value={pathValue}
            onChange={(event) => setPathValue(event.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => setBrowseOpen(true)}
            className="shrink-0 rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-100 hover:border-amber-400"
          >
            Browse
          </button>
        </div>
      </label>
      <p className="text-xs text-zinc-500">
        Browse the configured folder, or paste an <code>smb://</code> / UNC path. The file must
        already exist on the share. MovieDB reads size, codec, and TMDB details — it does not copy
        the file.
      </p>
      {!tmdbConfigured ? (
        <p className="text-xs text-amber-400">
          No TMDB API key is saved. The file can still be added; you will match the title under
          Review matches.
        </p>
      ) : null}

      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className="text-sm text-emerald-400">
          {state.message}{" "}
          {state.href ? (
            <Link href={state.href} className="text-amber-300 hover:text-amber-200">
              Open
            </Link>
          ) : null}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add file"}
      </button>

      {browseOpen && selected ? (
        <FolderBrowser
          folder={selected}
          onClose={() => setBrowseOpen(false)}
          onPick={(filePath) => {
            setPathValue(filePath);
            setBrowseOpen(false);
          }}
        />
      ) : null}
    </form>
  );
}

function FolderBrowser({
  folder,
  onClose,
  onPick,
}: {
  folder: AddFileFolder;
  onClose: () => void;
  onPick: (path: string) => void;
}) {
  const [relativeDir, setRelativeDir] = useState("");
  const [entries, setEntries] = useState<BrowserEntry[]>([]);
  const [parentDir, setParentDir] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listFolderBrowserAction(folder.id, relativeDir).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        setEntries([]);
        return;
      }
      setEntries(result.entries);
      setParentDir(result.parentDir);
    });
    return () => {
      cancelled = true;
    };
  }, [folder.id, relativeDir]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const crumbs = relativeDir ? relativeDir.split("/") : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close browser" />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">Choose a video file</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {folder.label} · {describeFolder(folder)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-200">
            Close
          </button>
        </div>

        <nav className="flex flex-wrap items-center gap-1 border-b border-zinc-800 px-4 py-2 text-xs">
          <button
            type="button"
            onClick={() => setRelativeDir("")}
            className="rounded px-1.5 py-0.5 text-amber-300 hover:bg-zinc-800"
          >
            Root
          </button>
          {crumbs.map((crumb, index) => {
            const target = crumbs.slice(0, index + 1).join("/");
            return (
              <span key={target} className="flex items-center gap-1">
                <span className="text-zinc-600">/</span>
                <button
                  type="button"
                  onClick={() => setRelativeDir(target)}
                  className="rounded px-1.5 py-0.5 text-amber-300 hover:bg-zinc-800"
                >
                  {crumb}
                </button>
              </span>
            );
          })}
        </nav>

        <div className="min-h-48 overflow-y-auto p-2">
          {loading ? <p className="px-2 py-6 text-sm text-zinc-500">Loading…</p> : null}
          {error ? <p className="px-2 py-6 text-sm text-red-400">{error}</p> : null}
          {!loading && !error ? (
            <ul>
              {parentDir !== null ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setRelativeDir(parentDir)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                  >
                    <span className="w-10 text-xs uppercase tracking-wide text-zinc-500">Up</span>
                    ..
                  </button>
                </li>
              ) : null}
              {entries.map((entry) => (
                <li key={`${entry.isDirectory ? "d" : "f"}:${entry.name}`}>
                  {entry.isDirectory ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRelativeDir(relativeDir ? `${relativeDir}/${entry.name}` : entry.name)
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                    >
                      <span className="w-10 text-xs uppercase tracking-wide text-zinc-500">Dir</span>
                      {entry.name}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => entry.importPath && onPick(entry.importPath)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                    >
                      <span className="w-10 text-xs uppercase tracking-wide text-amber-400">File</span>
                      {entry.name}
                    </button>
                  )}
                </li>
              ))}
              {entries.length === 0 ? (
                <li className="px-3 py-6 text-sm text-zinc-500">No folders or video files here.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function describeFolder(folder: AddFileFolder): string {
  if (folder.kind === "local") return folder.path ?? "Local folder";
  const sub = folder.smbFolder ? `/${folder.smbFolder}` : "";
  return `smb://${folder.smbHost}/${folder.smbShare}${sub}`;
}

function examplePath(folder: AddFileFolder): string {
  if (folder.kind === "local") {
    const root = (folder.path ?? "/media").replace(/\/+$/, "");
    return `${root}/The Matrix (1999).mkv`;
  }
  const sub = folder.smbFolder ? `${folder.smbFolder}/` : "";
  return `smb://${folder.smbHost}/${folder.smbShare}/${sub}The Matrix (1999).mkv`;
}

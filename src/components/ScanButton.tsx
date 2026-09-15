"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ScanKind, ScanProgress } from "@/lib/scan-types";

const idleProgress = (): ScanProgress => ({
  status: "idle",
  phase: "idle",
  kind: "full",
  filesFound: 0,
  processed: 0,
  currentFile: null,
  matched: 0,
  needsReview: 0,
  skipped: 0,
  folderErrors: [],
});

function isBusy(status: ScanProgress["status"]) {
  return status === "running" || status === "paused";
}

export function ScanButton({
  tmdbConfigured,
  showScan = true,
  showMetadata = true,
  showMedia,
}: {
  tmdbConfigured: boolean;
  showScan?: boolean;
  showMetadata?: boolean;
  showMedia?: boolean;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<ScanProgress>(idleProgress);
  const [error, setError] = useState<string | null>(null);

  const busy = isBusy(progress.status);
  const mediaVisible = showMedia ?? showScan;
  const canStartLibrary = tmdbConfigured && !busy;
  const canStartFiles = !busy;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/scan");
        if (!response.ok) return;
        const data = (await response.json()) as ScanProgress;
        if (!cancelled) setProgress(data);
      } catch {
        // Keep the last known progress if a poll fails.
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, busy ? 700 : 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [busy]);

  useEffect(() => {
    if (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") {
      router.refresh();
    }
  }, [progress.status, router]);

  async function start(mode: ScanKind) {
    setError(null);
    const response = await fetch("/api/admin/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not start the job.");
      return;
    }
    setProgress(data);
  }

  async function control(action: "pause" | "resume" | "stop") {
    setError(null);
    const response = await fetch("/api/admin/scan/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not update the scan.");
      return;
    }
    setProgress(data);
  }

  const percent =
    progress.filesFound > 0
      ? Math.min(100, Math.round((progress.processed / progress.filesFound) * 100))
      : busy && (progress.phase === "listing" || progress.phase === "metadata")
        ? null
        : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {showScan ? (
          <>
            <button
              type="button"
              onClick={() => start("full")}
              disabled={!canStartLibrary}
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:hover:bg-zinc-700"
            >
              Scan folders
            </button>
            <button
              type="button"
              onClick={() => start("new")}
              disabled={!canStartLibrary}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Scan new movies
            </button>
          </>
        ) : null}
        {mediaVisible ? (
          <button
            type="button"
            onClick={() => start("media")}
            disabled={!canStartFiles}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Update file info
          </button>
        ) : null}
        {showMetadata ? (
          <button
            type="button"
            onClick={() => start("metadata")}
            disabled={!canStartLibrary}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Update metadata
          </button>
        ) : null}
        {busy ? (
          <>
            {progress.status === "paused" ? (
              <button
                type="button"
                onClick={() => control("resume")}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400"
              >
                Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={() => control("pause")}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-100 hover:border-amber-400"
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={() => control("stop")}
              className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 hover:border-red-500"
            >
              Stop
            </button>
          </>
        ) : null}
      </div>

      {busy || progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-zinc-300">{statusLabel(progress)}</p>
            <p className="tabular-nums text-zinc-400">
              {progress.filesFound > 0
                ? `${progress.processed} / ${progress.filesFound}`
                : busy
                  ? "…"
                  : "0 / 0"}
              {percent !== null ? ` (${percent}%)` : ""}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full bg-amber-400 transition-[width] duration-300 ${
                percent === null ? "w-1/3 animate-pulse" : ""
              }`}
              style={percent === null ? undefined : { width: `${percent}%` }}
            />
          </div>
          {progress.currentFile ? (
            <p className="truncate text-xs text-zinc-500" title={progress.currentFile}>
              {progress.currentFile}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500">{countsLabel(progress)}</p>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          {!tmdbConfigured
            ? "Save a TMDB API key above before scanning folders or updating metadata. Update file info can run without it."
            : showScan
              ? "Scan folders re-checks every file. Scan new movies only looks for files that are not in the library yet. Update file info re-reads codec, HDR, audio, subtitles, filename, and size. Update metadata refreshes TMDB text, cast, directors, and genres without changing posters."
              : "Update metadata refreshes TMDB text, cast, directors, and genres for every title. Chosen posters and backdrops stay as they are."}
        </p>
      )}

      {error || progress.error ? (
        <p className="text-sm text-red-400">{error || progress.error}</p>
      ) : null}
      {progress.folderErrors.length ? (
        <p className="text-sm text-red-400">{progress.folderErrors.join(" ")}</p>
      ) : null}
    </div>
  );
}

function statusLabel(progress: ScanProgress) {
  if (progress.status === "paused") return "Paused";
  if (progress.status === "cancelled") return "Stopped";
  if (progress.status === "failed") return "Failed";
  if (progress.status === "completed") {
    if (progress.kind === "metadata") return "Metadata updated";
    if (progress.kind === "media") return "File info updated";
    if (progress.kind === "new") return "New files finished";
    return "Finished";
  }
  if (progress.phase === "listing") return "Listing files…";
  if (progress.phase === "probing") return "Reading media info…";
  if (progress.phase === "metadata") return "Updating metadata…";
  return "Matching titles…";
}

function countsLabel(progress: ScanProgress) {
  if (progress.kind === "metadata") {
    return `${progress.matched} updated · ${progress.skipped} failed`;
  }
  if (progress.kind === "media") {
    return `${progress.matched} updated · ${progress.skipped} failed`;
  }
  return `${progress.matched} matched · ${progress.needsReview} need review · ${progress.skipped} skipped`;
}

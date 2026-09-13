import type { ScanKind, ScanPhase, ScanProgress, ScanStatus } from "./scan-types";

export type { ScanKind, ScanPhase, ScanProgress, ScanStatus };

export class ScanStopped extends Error {
  constructor() {
    super("Scan stopped.");
    this.name = "ScanStopped";
  }
}

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

let progress: ScanProgress = idleProgress();
let control: "run" | "pause" | "stop" = "run";
let active = false;

export function getScanProgress(): ScanProgress {
  return {
    ...progress,
    folderErrors: [...progress.folderErrors],
  };
}

export function isScanActive(): boolean {
  return active;
}

export function beginScan(kind: ScanKind = "full"): boolean {
  if (active) return false;
  active = true;
  control = "run";
  progress = {
    ...idleProgress(),
    status: "running",
    kind,
    phase: kind === "metadata" ? "metadata" : "listing",
  };
  return true;
}

export function endScan() {
  active = false;
  control = "run";
}

export function updateScanProgress(patch: Partial<ScanProgress>) {
  progress = { ...progress, ...patch };
}

export function requestScanPause(): boolean {
  if (!active || progress.status === "cancelled") return false;
  if (progress.status !== "running" && progress.status !== "paused") return false;
  control = "pause";
  progress = { ...progress, status: "paused" };
  return true;
}

export function requestScanResume(): boolean {
  if (!active || control !== "pause") return false;
  control = "run";
  progress = { ...progress, status: "running" };
  return true;
}

export function requestScanStop(): boolean {
  if (!active) return false;
  control = "stop";
  progress = { ...progress, status: "cancelled", currentFile: null };
  return true;
}

export async function yieldScanControl(): Promise<void> {
  while (true) {
    if (control === "stop") throw new ScanStopped();
    if (control === "pause") {
      progress = { ...progress, status: "paused" };
      await delay(100);
      continue;
    }
    if (progress.status === "paused") {
      progress = { ...progress, status: "running" };
    }
    return;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

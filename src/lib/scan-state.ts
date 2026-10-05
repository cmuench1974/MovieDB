import type { ScanKind, ScanPhase, ScanProgress, ScanStatus } from "./scan-types";

export type { ScanKind, ScanPhase, ScanProgress, ScanStatus };

export class ScanStopped extends Error {
  constructor() {
    super("Scan stopped.");
    this.name = "ScanStopped";
  }
}

type ScanRuntime = {
  progress: ScanProgress;
  control: "run" | "pause" | "stop";
  active: boolean;
  heartbeat: number;
};

const STALE_MS = 5 * 60 * 1000;
const GLOBAL_KEY = "__moviedbScanRuntime" as const;

const idleProgress = (): ScanProgress => ({
  status: "idle",
  phase: "idle",
  kind: "full",
  filesFound: 0,
  listedCount: 0,
  processed: 0,
  currentFile: null,
  matched: 0,
  needsReview: 0,
  skipped: 0,
  folderErrors: [],
});

function runtime(): ScanRuntime {
  const globalRef = globalThis as typeof globalThis & { [GLOBAL_KEY]?: ScanRuntime };
  if (!globalRef[GLOBAL_KEY]) {
    globalRef[GLOBAL_KEY] = {
      progress: idleProgress(),
      control: "run",
      active: false,
      heartbeat: 0,
    };
  }
  return globalRef[GLOBAL_KEY];
}

function touch() {
  runtime().heartbeat = Date.now();
}

export function getScanProgress(): ScanProgress {
  const { progress } = runtime();
  return {
    ...progress,
    folderErrors: [...progress.folderErrors],
  };
}

export function isScanActive(): boolean {
  return runtime().active;
}

/** Löst hängengebliebene Locks (abgebrochener Request in Produktion). */
export function recoverStaleScan() {
  const rt = runtime();
  if (!rt.active) return;
  if (Date.now() - rt.heartbeat <= STALE_MS) return;
  console.warn("Clearing a stale scan lock.");
  rt.active = false;
  rt.control = "run";
  if (rt.progress.status === "running" || rt.progress.status === "paused") {
    rt.progress = {
      ...rt.progress,
      status: "failed",
      phase: "idle",
      error: "The previous scan was interrupted. Start it again.",
    };
  }
}

export function beginScan(kind: ScanKind = "full"): boolean {
  recoverStaleScan();
  const rt = runtime();
  if (rt.active) return false;
  rt.active = true;
  rt.control = "run";
  rt.progress = {
    ...idleProgress(),
    status: "running",
    kind,
    phase: kind === "metadata" ? "metadata" : "listing",
  };
  touch();
  return true;
}

export function endScan() {
  const rt = runtime();
  rt.active = false;
  rt.control = "run";
  touch();
}

export function updateScanProgress(patch: Partial<ScanProgress>) {
  const rt = runtime();
  rt.progress = { ...rt.progress, ...patch };
  touch();
}

export function requestScanPause(): boolean {
  const rt = runtime();
  if (!rt.active || rt.progress.status === "cancelled") return false;
  if (rt.progress.status !== "running" && rt.progress.status !== "paused") return false;
  rt.control = "pause";
  rt.progress = { ...rt.progress, status: "paused" };
  touch();
  return true;
}

export function requestScanResume(): boolean {
  const rt = runtime();
  if (!rt.active || rt.control !== "pause") return false;
  rt.control = "run";
  rt.progress = { ...rt.progress, status: "running" };
  touch();
  return true;
}

export function requestScanStop(): boolean {
  const rt = runtime();
  if (!rt.active) return false;
  rt.control = "stop";
  rt.progress = { ...rt.progress, status: "cancelled", currentFile: null };
  touch();
  return true;
}

export async function yieldScanControl(): Promise<void> {
  const rt = runtime();
  while (true) {
    if (rt.control === "stop") throw new ScanStopped();
    if (rt.control === "pause") {
      rt.progress = { ...rt.progress, status: "paused" };
      await delay(100);
      continue;
    }
    if (rt.progress.status === "paused") {
      rt.progress = { ...rt.progress, status: "running" };
    }
    touch();
    return;
  }
}

/**
 * Löst die Arbeit vom HTTP-Request. Sonst wartet next start auf den Scan
 * oder bricht ihn ab, sobald die Antwort rausgeht — auf Produktion wirkt der
 * Klick dann wie „nichts passiert“.
 */
export function scheduleBackground(work: () => Promise<void>) {
  setImmediate(() => {
    void work().catch((error) => {
      console.error("Background scan failed:", error);
      updateScanProgress({
        status: "failed",
        phase: "idle",
        error: error instanceof Error ? error.message : "Scan failed.",
      });
      endScan();
    });
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

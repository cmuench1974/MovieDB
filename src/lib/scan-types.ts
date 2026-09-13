export type ScanStatus = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type ScanPhase = "idle" | "listing" | "matching" | "probing" | "metadata";
export type ScanKind = "full" | "new" | "metadata";

export type ScanProgress = {
  status: ScanStatus;
  phase: ScanPhase;
  kind: ScanKind;
  filesFound: number;
  processed: number;
  currentFile: string | null;
  matched: number;
  needsReview: number;
  skipped: number;
  error?: string;
  folderErrors: string[];
};

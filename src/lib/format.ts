export function formatRuntime(minutes?: number | null): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

export function formatRuntimeFromSeconds(seconds?: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  return formatRuntime(Math.round(seconds / 60));
}

export function formatBytes(bytes: bigint | number): string {
  const value = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** index;
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatVote(vote?: number | null): string | null {
  if (vote == null || vote <= 0) return null;
  return vote.toFixed(1);
}

export type ResolutionClass = "sd" | "hd" | "uhd";

export type VersionFile = {
  id: string;
  filename: string;
  resolutionClass: string | null;
};

export type LabeledVersion = {
  id: string;
  label: string;
};

const CLASS_RANK: Record<ResolutionClass, number> = {
  uhd: 0,
  hd: 1,
  sd: 2,
};

export function isResolutionClass(value: string | null | undefined): value is ResolutionClass {
  return value === "sd" || value === "hd" || value === "uhd";
}

export function labelForResolutionClass(value: string | null | undefined): string | null {
  if (value === "uhd") return "UHD";
  if (value === "hd") return "HD";
  if (value === "sd") return "SD";
  return null;
}

export function resolutionClassFromPixels(
  width?: number | null,
  height?: number | null,
): ResolutionClass | null {
  const w = width ?? 0;
  const h = height ?? 0;
  if (w <= 0 && h <= 0) return null;
  if (h >= 2160 || w >= 3840) return "uhd";
  if (h >= 720 || w >= 1280) return "hd";
  return "sd";
}

/**
 * HD/UHD/SD nur, wenn jede Datei eine bekannte Klasse hat und die Klassen eindeutig sind.
 * Sonst Version 1, Version 2, … in stabiler Dateinamen-Reihenfolge.
 */
export function labelMovieVersions(files: VersionFile[]): LabeledVersion[] {
  const sorted = sortVersions(files);
  if (sorted.length === 0) return [];

  if (sorted.length === 1) {
    return [
      {
        id: sorted[0].id,
        label: labelForResolutionClass(sorted[0].resolutionClass) ?? "Version 1",
      },
    ];
  }

  const classes = sorted.map((file) => file.resolutionClass);
  const allKnown = classes.every(isResolutionClass);
  const unique = new Set(classes);
  if (allKnown && unique.size === sorted.length) {
    return sorted.map((file) => ({
      id: file.id,
      label: labelForResolutionClass(file.resolutionClass) ?? file.filename,
    }));
  }

  return sorted.map((file, index) => ({
    id: file.id,
    label: `Version ${index + 1}`,
  }));
}

export function sortVersions(files: VersionFile[]): VersionFile[] {
  return [...files].sort((a, b) => {
    const rankA = isResolutionClass(a.resolutionClass)
      ? CLASS_RANK[a.resolutionClass]
      : 99;
    const rankB = isResolutionClass(b.resolutionClass)
      ? CLASS_RANK[b.resolutionClass]
      : 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" });
  });
}

export function pickDefaultVersionId(
  files: VersionFile[],
  requestedId?: string | null,
): string | null {
  if (requestedId && files.some((file) => file.id === requestedId)) {
    return requestedId;
  }
  return sortVersions(files)[0]?.id ?? null;
}

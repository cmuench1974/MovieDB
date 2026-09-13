import { formatBytes, formatRuntime, formatRuntimeFromSeconds } from "./format";
import {
  codecLabel,
  formatAudioTrack,
  formatSubtitleTrack,
  parseAudioTracks,
  parseSubtitleTracks,
} from "./media-info";
import { labelForResolutionClass, labelMovieVersions, pickDefaultVersionId } from "./versions";

export type MovieVersionView = {
  id: string;
  label: string;
  filename: string;
  sizeLabel: string;
  title: string;
  year: number | null;
  overview: string | null;
  runtimeLabel: string | null;
  resolutionLabel: string | null;
  hdrFormat: string | null;
  videoCodec: string | null;
  pixelLabel: string | null;
  audioLabels: string[];
  subtitleLabels: string[];
  probeError: string | null;
  probed: boolean;
};

type MovieDefaults = {
  title: string;
  year: number | null;
  overview: string | null;
  runtime: number | null;
};

type VersionSource = {
  id: string;
  filename: string;
  size: bigint;
  title: string | null;
  year: number | null;
  overview: string | null;
  width: number | null;
  height: number | null;
  resolutionClass: string | null;
  hdrFormat: string | null;
  durationSec: number | null;
  videoCodec: string | null;
  audioTracks: unknown;
  subtitleTracks: unknown;
  probeError: string | null;
  probedAt: Date | null;
};

export function buildVersionViews(
  movie: MovieDefaults,
  files: VersionSource[],
): MovieVersionView[] {
  const labels = new Map(labelMovieVersions(files).map((item) => [item.id, item.label]));
  return files
    .map((file) => {
      const audio = parseAudioTracks(file.audioTracks);
      const subs = parseSubtitleTracks(file.subtitleTracks);
      const runtimeLabel =
        formatRuntimeFromSeconds(file.durationSec) ?? formatRuntime(movie.runtime);
      const pixelLabel =
        file.width && file.height ? `${file.width}×${file.height}` : null;

      return {
        id: file.id,
        label: labels.get(file.id) ?? file.filename,
        filename: file.filename,
        sizeLabel: formatBytes(file.size),
        title: file.title || movie.title,
        year: file.year ?? movie.year,
        overview: file.overview || movie.overview,
        runtimeLabel,
        resolutionLabel: labelForResolutionClass(file.resolutionClass),
        hdrFormat: file.hdrFormat,
        videoCodec: codecLabel(file.videoCodec),
        pixelLabel,
        audioLabels: audio.map(formatAudioTrack),
        subtitleLabels: subs.map(formatSubtitleTrack),
        probeError: file.probeError,
        probed: file.probedAt != null,
      };
    })
    .sort((a, b) => {
      const order = [...labels.keys()];
      return order.indexOf(a.id) - order.indexOf(b.id);
    });
}

export function defaultVersionId(
  files: { id: string; filename: string; resolutionClass: string | null }[],
  requestedId?: string | null,
): string | null {
  return pickDefaultVersionId(files, requestedId);
}

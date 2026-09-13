import { resolutionClassFromPixels, type ResolutionClass } from "./versions";

export type AudioTrackInfo = {
  language: string | null;
  codec: string | null;
  channels: number | null;
  channelLayout: string | null;
  title: string | null;
  isDefault: boolean;
};

export type SubtitleTrackInfo = {
  language: string | null;
  codec: string | null;
  title: string | null;
  isDefault: boolean;
  isForced: boolean;
};

export type FilenameHints = {
  resolutionClass: ResolutionClass | null;
  hdrFormat: string | null;
};

const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  en: "English",
  deu: "German",
  ger: "German",
  de: "German",
  fra: "French",
  fre: "French",
  fr: "French",
  spa: "Spanish",
  es: "Spanish",
  ita: "Italian",
  it: "Italian",
  jpn: "Japanese",
  ja: "Japanese",
  kor: "Korean",
  ko: "Korean",
  chi: "Chinese",
  zho: "Chinese",
  zh: "Chinese",
  rus: "Russian",
  ru: "Russian",
  nld: "Dutch",
  dut: "Dutch",
  nl: "Dutch",
  por: "Portuguese",
  pt: "Portuguese",
  pol: "Polish",
  pl: "Polish",
  swe: "Swedish",
  sv: "Swedish",
  nor: "Norwegian",
  no: "Norwegian",
  dan: "Danish",
  da: "Danish",
  fin: "Finnish",
  fi: "Finnish",
  hun: "Hungarian",
  hu: "Hungarian",
  ces: "Czech",
  cze: "Czech",
  cs: "Czech",
  tur: "Turkish",
  tr: "Turkish",
  ara: "Arabic",
  ar: "Arabic",
  hin: "Hindi",
  hi: "Hindi",
  tha: "Thai",
  th: "Thai",
  und: "Unknown",
};

const CODEC_NAMES: Record<string, string> = {
  truehd: "TrueHD",
  dts: "DTS",
  "dts-hd": "DTS-HD",
  dca: "DTS",
  ac3: "AC-3",
  eac3: "E-AC-3",
  aac: "AAC",
  flac: "FLAC",
  pcm_s16le: "PCM",
  pcm_s24le: "PCM",
  opus: "Opus",
  mp3: "MP3",
  vorbis: "Vorbis",
  h264: "H.264",
  avc: "H.264",
  hevc: "HEVC",
  h265: "HEVC",
  av1: "AV1",
  vp9: "VP9",
  vc1: "VC-1",
  mpeg2video: "MPEG-2",
  subrip: "SRT",
  srt: "SRT",
  ass: "ASS",
  ssa: "SSA",
  hdmv_pgs_subtitle: "PGS",
  pgs: "PGS",
  dvd_subtitle: "VobSub",
  dvdsub: "VobSub",
  mov_text: "MovText",
  webvtt: "WebVTT",
};

export function hintsFromFilename(filename: string): FilenameHints {
  const name = filename.toLowerCase();
  let resolutionClass: ResolutionClass | null = null;
  if (/\b(2160p|3840p|4k|uhd)\b/.test(name)) resolutionClass = "uhd";
  else if (/\b(1080p|720p|fhd|hd)\b/.test(name)) resolutionClass = "hd";
  else if (/\b(480p|576p|sd)\b/.test(name)) resolutionClass = "sd";

  let hdrFormat: string | null = null;
  if (/\b(dolby[\s._-]*vision|dovi|dv)\b/.test(name)) hdrFormat = "Dolby Vision";
  else if (/\bhdr10\+|hdr10plus|hdr10[\s._-]*plus\b/.test(name)) hdrFormat = "HDR10+";
  else if (/\bhdr10\b/.test(name)) hdrFormat = "HDR10";
  else if (/\bhlg\b/.test(name)) hdrFormat = "HLG";
  else if (/\bhdr\b/.test(name)) hdrFormat = "HDR";

  return { resolutionClass, hdrFormat };
}

export function mergeResolutionClass(
  probed: ResolutionClass | null,
  hinted: ResolutionClass | null,
): ResolutionClass | null {
  return probed ?? hinted;
}

export function mergeHdrFormat(probed: string | null, hinted: string | null): string | null {
  if (probed && probed !== "SDR") return probed;
  if (hinted) return hinted;
  return probed;
}

export function languageLabel(code?: string | null): string {
  if (!code) return "Unknown";
  const normalized = code.trim().toLowerCase();
  if (!normalized || normalized === "und") return "Unknown";
  return LANGUAGE_NAMES[normalized] ?? code.toUpperCase();
}

export function codecLabel(codec?: string | null): string | null {
  if (!codec) return null;
  const key = codec.trim().toLowerCase();
  return CODEC_NAMES[key] ?? codec.toUpperCase();
}

export function channelLabel(channels?: number | null, layout?: string | null): string | null {
  if (layout) {
    const compact = layout.replace(/\s+/g, "");
    if (compact) return compact;
  }
  if (!channels) return null;
  if (channels === 1) return "1.0";
  if (channels === 2) return "2.0";
  if (channels === 6) return "5.1";
  if (channels === 8) return "7.1";
  return `${channels}ch`;
}

export function formatAudioTrack(track: AudioTrackInfo): string {
  const parts = [
    languageLabel(track.language),
    codecLabel(track.codec),
    channelLabel(track.channels, track.channelLayout),
  ].filter(Boolean);
  if (track.title && !parts.some((part) => part?.toLowerCase().includes(track.title!.toLowerCase()))) {
    parts.push(track.title);
  }
  return parts.join(" · ");
}

export function formatSubtitleTrack(track: SubtitleTrackInfo): string {
  const bits = [languageLabel(track.language)];
  const codec = codecLabel(track.codec);
  if (codec) bits.push(codec);
  if (track.isForced) bits.push("forced");
  if (track.title) bits.push(track.title);
  return bits.join(" · ");
}

export function parseAudioTracks(value: unknown): AudioTrackInfo[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      language: stringOrNull(row.language),
      codec: stringOrNull(row.codec),
      channels: numberOrNull(row.channels),
      channelLayout: stringOrNull(row.channelLayout),
      title: stringOrNull(row.title),
      isDefault: row.isDefault === true,
    };
  });
}

export function parseSubtitleTracks(value: unknown): SubtitleTrackInfo[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      language: stringOrNull(row.language),
      codec: stringOrNull(row.codec),
      title: stringOrNull(row.title),
      isDefault: row.isDefault === true,
      isForced: row.isForced === true,
    };
  });
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resolutionClassFromProbe(
  width?: number | null,
  height?: number | null,
): ResolutionClass | null {
  return resolutionClassFromPixels(width, height);
}

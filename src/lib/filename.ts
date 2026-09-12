export type ParsedFilename = {
  title: string;
  year: number | null;
};

const VIDEO_EXTENSIONS = new Set([
  ".mkv",
  ".mp4",
  ".avi",
  ".m4v",
  ".mov",
  ".webm",
  ".iso",
  ".m2ts",
  ".ts",
]);

const SKIP_DIRS = new Set([
  "@eadir",
  "#recycle",
  "$recycle.bin",
  "system volume information",
  "thumbs",
  ".ds_store",
  ".recycle",
]);

// Scene / rip tags that should not become part of the movie title.
const JUNK_TOKENS = [
  "1080p",
  "720p",
  "480p",
  "2160p",
  "4k",
  "uhd",
  "hdr",
  "hdr10",
  "hdr10plus",
  "dv",
  "dovi",
  "sdr",
  "bluray",
  "blu-ray",
  "bdrip",
  "brrip",
  "webrip",
  "web-dl",
  "webdl",
  "hdtv",
  "dvdrip",
  "dvd",
  "remux",
  "hybrid",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "avc",
  "av1",
  "aac",
  "ac3",
  "dts",
  "dtshd",
  "truehd",
  "atmos",
  "flac",
  "dd5",
  "ddp5",
  "ddp",
  "ma",
  "proper",
  "repack",
  "extended",
  "unrated",
  "directors",
  "theatrical",
  "limited",
  "internal",
  "multi",
  "subs",
  "subbed",
  "dubbed",
  "german",
  "english",
  "french",
  "italian",
  "spanish",
  "nl",
  "dl",
  "readnfo",
  "nfo",
  "yify",
  "rarbg",
  "ettv",
  "eztv",
  "sparks",
  "ntb",
  "amiable",
  "flux",
  "tigole",
  "criterion",
];

const GENERIC_TITLES = new Set([
  "movie",
  "video",
  "film",
  "cd1",
  "cd2",
  "disc1",
  "disc2",
  "disk1",
  "disk2",
]);

export function isVideoFile(filename: string): boolean {
  const ext = extensionOf(filename);
  return VIDEO_EXTENSIONS.has(ext);
}

export function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name.toLowerCase()) || name.startsWith(".");
}

/**
 * Turns a video filename (and optional parent folder) into a title + year.
 * Examples: "The Matrix (1999).mkv", "the.matrix.1999.1080p.mkv"
 */
export function parseVideoFilename(
  filename: string,
  parentFolder?: string,
): ParsedFilename {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const parsed = parseName(withoutExt);

  if (!parsed.title || GENERIC_TITLES.has(parsed.title.toLowerCase())) {
    if (parentFolder) {
      const fromFolder = parseName(parentFolder);
      if (fromFolder.title) return fromFolder;
    }
  }

  return parsed;
}

function parseName(raw: string): ParsedFilename {
  let name = raw.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();

  let year: number | null = null;
  const parenYear = name.match(/\((\d{4})\)/);
  if (parenYear) {
    year = Number(parenYear[1]);
    name = name.replace(parenYear[0], " ");
  } else {
    const yearMatch = name.match(/(?:^|\s)((?:19|20)\d{2})(?:\s|$)/);
    if (yearMatch) {
      year = Number(yearMatch[1]);
      name = name.slice(0, yearMatch.index);
    }
  }

  const junk = new Set(JUNK_TOKENS);
  const words = name
    .replace(/[\[\](){}]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !junk.has(word.toLowerCase()))
    .filter((word) => !/^\d{3,4}p$/i.test(word));

  const title = words.join(" ").replace(/\s+/g, " ").trim();
  return { title, year };
}

function extensionOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|a|an)\s+/, "")
    .trim();
}

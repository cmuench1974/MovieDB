import { fallbackTmdbApiKey, getTmdbApiKey } from "./settings";

export type TmdbCandidate = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
};

export type TmdbCastMember = {
  id?: number;
  name: string;
  character: string;
  profile_path: string | null;
};

export type TmdbCrewMember = {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
};

export type TmdbMovieDetails = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  runtime: number | null;
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genres: { id: number; name: string }[];
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }[];
    crew?: TmdbCrewMember[];
  };
};

export { tmdbImageUrl } from "./tmdb-image";

const TMDB_API = "https://api.themoviedb.org/3";

async function apiKey(): Promise<string> {
  const key = await getTmdbApiKey();
  if (!key) {
    throw new Error("No TMDB API key yet. Add it under Admin → TMDB API key.");
  }
  return key;
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const keys = tmdbKeyCandidates(await apiKey());
  let lastStatus = 0;
  for (const [key, mode] of keys) {
    const response = await tmdbFetch(path, params, key, mode);
    lastStatus = response.status;
    if (response.ok) return (await response.json()) as T;
    if (response.status !== 401 && response.status !== 403) break;
  }
  throw new Error(`TMDB request failed (${lastStatus}) for ${path}`);
}

function tmdbKeyCandidates(primary: string): [string, "query" | "bearer"][] {
  const keys = [primary];
  const fallback = fallbackTmdbApiKey(primary);
  if (fallback) keys.push(fallback);
  const unique = [...new Set(keys)];
  const modes: ("query" | "bearer")[] = ["query", "bearer"];
  const out: [string, "query" | "bearer"][] = [];
  for (const key of unique) {
    const preferred: ("query" | "bearer")[] = key.startsWith("eyJ")
      ? ["bearer", "query"]
      : ["query", "bearer"];
    for (const mode of preferred) {
      if (modes.includes(mode)) out.push([key, mode]);
    }
  }
  return out;
}

async function tmdbFetch(
  path: string,
  params: Record<string, string>,
  key: string,
  mode: "query" | "bearer",
): Promise<Response> {
  const url = new URL(`${TMDB_API}${path}`);
  url.searchParams.set("language", "en-US");
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
  }
  const headers: Record<string, string> = {};
  if (mode === "bearer") {
    headers.Authorization = `Bearer ${key}`;
  } else {
    url.searchParams.set("api_key", key);
  }
  return fetch(url, { cache: "no-store", headers });
}

export async function searchMovies(
  title: string,
  year?: number | null,
): Promise<TmdbCandidate[]> {
  if (!title.trim()) return [];

  const data = await tmdbGet<{ results: TmdbCandidate[] }>("/search/movie", {
    query: title,
    year: year ? String(year) : "",
    include_adult: "false",
  });

  return (data.results ?? []).slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    original_title: item.original_title,
    release_date: item.release_date,
    poster_path: item.poster_path,
    overview: item.overview,
    vote_average: item.vote_average,
  }));
}

export async function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
  return tmdbGet<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    append_to_response: "credits",
  });
}

export type TmdbImageOption = {
  file_path: string;
  vote_average: number;
  width: number;
  height: number;
  iso_639_1: string | null;
};

/** Poster- und Backdrop-Varianten eines TMDB-Titels, sortiert nach Bewertung. */
export async function getMovieImages(tmdbId: number): Promise<{
  posters: TmdbImageOption[];
  backdrops: TmdbImageOption[];
}> {
  const data = await tmdbGet<{
    posters?: TmdbImageOption[];
    backdrops?: TmdbImageOption[];
  }>(`/movie/${tmdbId}/images`, {
    include_image_language: "en,null",
  });

  return {
    posters: rankImages(data.posters ?? [], 24),
    backdrops: rankImages(data.backdrops ?? [], 16),
  };
}

function rankImages(items: TmdbImageOption[], limit: number): TmdbImageOption[] {
  return items
    .filter((item) => item.file_path)
    .slice()
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, limit);
}

/**
 * Accepts a TMDB movie URL or a numeric id.
 * Only themoviedb.org URLs are allowed — arbitrary hosts are rejected.
 */
export function parseTmdbMovieId(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d{1,10}$/.test(trimmed)) {
    return Number(trimmed);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host !== "themoviedb.org") return null;

  const match = url.pathname.match(/^\/movie\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function yearFromReleaseDate(releaseDate?: string | null): number | null {
  if (!releaseDate || releaseDate.length < 4) return null;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

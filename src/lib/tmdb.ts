import { getTmdbApiKey } from "./settings";

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
  name: string;
  character: string;
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
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }[];
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
  const url = new URL(`${TMDB_API}${path}`);
  url.searchParams.set("api_key", await apiKey());
  url.searchParams.set("language", "en-US");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status}) for ${path}`);
  }
  return (await response.json()) as T;
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

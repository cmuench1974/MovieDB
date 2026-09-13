"use client";

import { useState, useTransition } from "react";
import { setMovieArtAction } from "@/app/admin/actions";
import { PosterImage } from "./PosterImage";

type ArtOption = { file_path: string };

export function MovieArtPicker({
  movieId,
  posterPath,
  backdropPath,
  posters,
  backdrops,
}: {
  movieId: string;
  posterPath: string | null;
  backdropPath: string | null;
  posters: ArtOption[];
  backdrops: ArtOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function select(kind: "poster" | "backdrop", path: string) {
    setError(null);
    setOk(null);
    startTransition(async () => {
      try {
        await setMovieArtAction(movieId, kind, path);
        setOk(kind === "poster" ? "Poster updated." : "Backdrop updated.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the image.");
      }
    });
  }

  return (
    <section className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div>
        <h2 className="text-lg font-medium">Poster and backdrop</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose TMDB artwork for this title. It is shared by all versions.
        </p>
      </div>

      <ArtGrid
        label="Poster"
        aspect="poster"
        current={posterPath}
        options={posters}
        disabled={pending}
        onSelect={(path) => select("poster", path)}
      />
      <ArtGrid
        label="Backdrop"
        aspect="backdrop"
        current={backdropPath}
        options={backdrops}
        disabled={pending}
        onSelect={(path) => select("backdrop", path)}
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}
    </section>
  );
}

function ArtGrid({
  label,
  aspect,
  current,
  options,
  disabled,
  onSelect,
}: {
  label: string;
  aspect: "poster" | "backdrop";
  current: string | null;
  options: ArtOption[];
  disabled: boolean;
  onSelect: (path: string) => void;
}) {
  const paths = uniquePaths([current, ...options.map((item) => item.file_path)]);

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">{label}</h3>
      {paths.length === 0 ? (
        <p className="text-sm text-zinc-500">No {label.toLowerCase()} options from TMDB.</p>
      ) : (
        <ul
          className={
            aspect === "poster"
              ? "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
              : "grid grid-cols-2 gap-2 sm:grid-cols-3"
          }
        >
          {paths.map((path) => {
            const selected = path === current;
            return (
              <li key={path}>
                <button
                  type="button"
                  disabled={disabled || selected}
                  onClick={() => onSelect(path)}
                  className={`relative block w-full overflow-hidden rounded-lg border ${
                    aspect === "poster" ? "aspect-[2/3]" : "aspect-video"
                  } ${
                    selected
                      ? "border-amber-400 ring-1 ring-amber-400"
                      : "border-zinc-800 hover:border-amber-400"
                  } disabled:opacity-70`}
                >
                  <PosterImage
                    path={path}
                    alt=""
                    size={aspect === "poster" ? "w185" : "w342"}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function uniquePaths(paths: (string | null | undefined)[]): string[] {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

import Link from "next/link";
import { PosterImage } from "./PosterImage";
import { movieDetailHref } from "@/lib/navigation";
import { labelForResolutionClass } from "@/lib/versions";

type MovieCardMovie = {
  id: string;
  title: string;
  year: number | null;
  directorName?: string | null;
  posterPath: string | null;
  hidden?: boolean;
  videoFiles?: { resolutionClass: string | null }[];
};

export function MovieCard({
  movie,
  highlighted = false,
  from,
}: {
  movie: MovieCardMovie;
  highlighted?: boolean;
  from?: string;
}) {
  const badges = uniqueResolutionBadges(movie.videoFiles ?? []);

  return (
    <Link
      href={movieDetailHref(movie.id, from)}
      className={`group block rounded-lg ${
        highlighted ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-950" : ""
      }`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
        <PosterImage path={movie.posterPath} alt={movie.title} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        {badges.length > 0 || movie.hidden ? (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {movie.hidden ? (
              <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-950">
                Hidden
              </span>
            ) : null}
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-100"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2">
        <h2 className="line-clamp-2 text-sm font-medium text-zinc-100 group-hover:text-amber-300">
          {movie.title}
        </h2>
        {movie.year || movie.directorName ? (
          <p className="line-clamp-2 text-xs text-zinc-500">
            {[movie.year, movie.directorName].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function uniqueResolutionBadges(files: { resolutionClass: string | null }[]): string[] {
  const order = ["UHD", "HD", "SD"];
  const labels = new Set(
    files
      .map((file) => labelForResolutionClass(file.resolutionClass))
      .filter((label): label is string => Boolean(label)),
  );
  return order.filter((label) => labels.has(label));
}

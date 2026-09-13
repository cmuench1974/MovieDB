import Link from "next/link";
import { PosterImage } from "./PosterImage";
import { labelForResolutionClass } from "@/lib/versions";

type MovieCardMovie = {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  videoFiles?: { resolutionClass: string | null }[];
};

export function MovieCard({ movie }: { movie: MovieCardMovie }) {
  const badges = uniqueResolutionBadges(movie.videoFiles ?? []);

  return (
    <Link href={`/movies/${movie.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
        <PosterImage path={movie.posterPath} alt={movie.title} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
        {badges.length > 0 ? (
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
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
        {movie.year ? <p className="text-xs text-zinc-500">{movie.year}</p> : null}
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

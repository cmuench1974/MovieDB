import Link from "next/link";
import { PosterImage } from "./PosterImage";

type MovieCardMovie = {
  id: string;
  title: string;
  year: number | null;
  posterPath: string | null;
};

export function MovieCard({ movie }: { movie: MovieCardMovie }) {
  return (
    <Link href={`/movies/${movie.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800">
        <PosterImage path={movie.posterPath} alt={movie.title} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
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

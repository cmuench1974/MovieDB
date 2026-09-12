import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PosterImage } from "@/components/PosterImage";
import { formatRuntime, formatVote, formatBytes } from "@/lib/format";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import type { TmdbCastMember } from "@/lib/tmdb";
import { auth } from "@/lib/auth";
import { MovieAdminButtons } from "@/components/MovieAdminButtons";

export const dynamic = "force-dynamic";

export default async function MoviePage({ params }: PageProps<"/movies/[id]">) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: {
      genres: { orderBy: { name: "asc" } },
      videoFiles: { orderBy: { filename: "asc" } },
    },
  });

  if (!movie || (movie.hidden && !session?.user)) notFound();

  const backdrop = tmdbImageUrl(movie.backdropPath, "w780");
  const cast = Array.isArray(movie.cast) ? (movie.cast as TmdbCastMember[]) : [];
  const vote = formatVote(movie.voteAverage);
  const runtime = formatRuntime(movie.runtime);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-zinc-800">
          {backdrop ? (
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              className="object-cover opacity-25"
            />
          ) : null}
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[16rem_1fr]">
            <div className="relative mx-auto aspect-[2/3] w-56 overflow-hidden rounded-xl bg-zinc-800 shadow-xl md:w-full">
              <PosterImage path={movie.posterPath} alt={movie.title} size="w500" />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm text-zinc-400">
                <Link href="/" className="hover:text-zinc-200">
                  Catalog
                </Link>
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                {movie.title}
              </h1>
              {movie.hidden ? (
                <p className="mt-2 text-sm text-amber-400">Hidden from the public catalog.</p>
              ) : null}
              <p className="mt-2 text-zinc-400">
                {[movie.year, runtime, vote ? `★ ${vote}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {movie.genres.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {movie.genres.map((genre) => (
                    <li
                      key={genre.id}
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
                    >
                      {genre.name}
                    </li>
                  ))}
                </ul>
              ) : null}
              {movie.overview ? (
                <p className="mt-6 max-w-2xl text-sm leading-7 text-zinc-300">
                  {movie.overview}
                </p>
              ) : null}
              {session?.user ? (
                <div className="mt-6">
                  <MovieAdminButtons movieId={movie.id} hidden={movie.hidden} title={movie.title} />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-10 space-y-10">
          {cast.length > 0 ? (
            <section>
              <h2 className="text-lg font-medium">Cast</h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {cast.map((member) => (
                  <li key={`${member.name}-${member.character}`} className="text-sm">
                    <p className="text-zinc-100">{member.name}</p>
                    <p className="text-zinc-500">{member.character}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-medium">Files</h2>
            {movie.videoFiles.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No files linked yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                {movie.videoFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <span className="truncate text-zinc-200">{file.filename}</span>
                    <span className="shrink-0 text-zinc-500">{formatBytes(file.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

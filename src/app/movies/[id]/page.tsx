import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MovieDetail } from "@/components/MovieDetail";
import { formatVote, formatRuntime } from "@/lib/format";
import { tmdbImageUrl } from "@/lib/tmdb-image";
import { buildVersionViews, defaultVersionId } from "@/lib/movie-view";
import type { TmdbCastMember } from "@/lib/tmdb";
import { auth } from "@/lib/auth";
import { getOwnedLists } from "@/lib/lists";
import { isAdminSession } from "@/lib/admin";
import { safeReturnPath, withMovieFocus } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function MoviePage({
  params,
  searchParams,
}: PageProps<"/movies/[id]">) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, auth()]);
  const requestedVersion = typeof query.v === "string" ? query.v : null;
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: {
      genres: { orderBy: { name: "asc" } },
      videoFiles: { orderBy: { filename: "asc" } },
      credits: {
        include: { person: { select: { id: true, name: true } } },
        orderBy: [{ billingOrder: "asc" }],
      },
    },
  });

  if (!movie || (movie.hidden && !session?.user)) notFound();

  const backdrop = tmdbImageUrl(movie.backdropPath, "w780");
  const directors = movie.credits
    .filter((credit) => credit.role === "director")
    .map((credit) => credit.person);
  const billedCast = movie.credits
    .filter((credit) => credit.role === "actor")
    .map((credit) => ({
      id: credit.person.id,
      name: credit.person.name,
      character: credit.character,
    }));
  const jsonCast = Array.isArray(movie.cast) ? (movie.cast as TmdbCastMember[]) : [];
  const vote = formatVote(movie.voteAverage);
  const versions = buildVersionViews(movie, movie.videoFiles);
  const initialVersionId = defaultVersionId(movie.videoFiles, requestedVersion);
  const lists = session?.user?.id ? await getOwnedLists(session.user.id) : [];
  const returnPath = safeReturnPath(typeof query.from === "string" ? query.from : undefined);
  const backHref = withMovieFocus(returnPath, movie.id);
  const personFrom = encodeURIComponent(`/movies/${movie.id}`);

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
          <MovieDetail
            movieId={movie.id}
            hidden={movie.hidden}
            posterPath={movie.posterPath}
            voteLabel={vote}
            genres={movie.genres}
            versions={versions}
            initialVersionId={initialVersionId}
            isAdmin={isAdminSession(session)}
            isLoggedIn={Boolean(session?.user)}
            lists={lists}
            catalogTitle={movie.title}
            catalogYear={movie.year}
            catalogOverview={movie.overview}
            catalogRuntime={formatRuntime(movie.runtime)}
            backHref={backHref}
            returnPath={returnPath}
            directors={directors}
            directorFallback={directors.length ? null : movie.directorName}
          />
        </section>

        <div className="mx-auto max-w-7xl px-4 py-10 space-y-10">
          {billedCast.length > 0 ? (
            <section>
              <h2 className="text-lg font-medium">Cast</h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {billedCast.map((member) => (
                  <li key={member.id} className="text-sm">
                    <Link
                      href={`/people/${member.id}?from=${personFrom}`}
                      className="text-zinc-100 hover:text-amber-300"
                    >
                      {member.name}
                    </Link>
                    {member.character ? (
                      <p className="text-zinc-500">{member.character}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : jsonCast.length > 0 ? (
            <section>
              <h2 className="text-lg font-medium">Cast</h2>
              <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {jsonCast.map((member) => (
                  <li key={`${member.name}-${member.character}`} className="text-sm">
                    <p className="text-zinc-100">{member.name}</p>
                    <p className="text-zinc-500">{member.character}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}

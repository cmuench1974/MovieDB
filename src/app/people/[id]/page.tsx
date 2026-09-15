import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { PosterImage } from "@/components/PosterImage";
import { auth } from "@/lib/auth";
import { safeReturnPath } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
  searchParams,
}: PageProps<"/people/[id]">) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, auth()]);
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      credits: {
        where: session?.user ? {} : { movie: { hidden: false } },
        include: {
          movie: {
            select: {
              id: true,
              title: true,
              year: true,
              directorName: true,
              posterPath: true,
              hidden: true,
              videoFiles: { select: { resolutionClass: true } },
            },
          },
        },
        orderBy: { billingOrder: "asc" },
      },
    },
  });

  if (!person || person.credits.length === 0) notFound();

  const directed = uniqueMovies(person.credits.filter((credit) => credit.role === "director"));
  const acted = uniqueMovies(person.credits.filter((credit) => credit.role === "actor"));
  const backHref = safeReturnPath(typeof query.from === "string" ? query.from : undefined);
  const from = `/people/${person.id}`;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Link href={backHref} className="text-sm text-zinc-400 hover:text-zinc-200">
          Back
        </Link>
        <div className="mt-4 flex items-start gap-5">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
            <PosterImage path={person.profilePath} alt={person.name} size="w185" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{person.name}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {[
                directed.length ? `${directed.length} as director` : null,
                acted.length ? `${acted.length} as actor` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {directed.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-medium">Director</h2>
            <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {directed.map((movie) => (
                <li key={`d-${movie.id}`}>
                  <MovieCard movie={movie} from={from} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {acted.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-lg font-medium">Actor</h2>
            <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {acted.map((movie) => (
                <li key={`a-${movie.id}`}>
                  <MovieCard movie={movie} from={from} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}

function uniqueMovies<
  T extends { movie: { id: string; title: string; year: number | null } },
>(credits: T[]) {
  const seen = new Set<string>();
  const movies: T["movie"][] = [];
  for (const credit of credits) {
    if (seen.has(credit.movie.id)) continue;
    seen.add(credit.movie.id);
    movies.push(credit.movie);
  }
  movies.sort((a, b) => {
    const title = a.title.localeCompare(b.title);
    if (title !== 0) return title;
    return (a.year ?? 9999) - (b.year ?? 9999);
  });
  return movies;
}

import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Filters } from "@/components/Filters";
import { CatalogScrollTo } from "@/components/CatalogScrollTo";
import { auth } from "@/lib/auth";
import {
  genreOptionsWhere,
  movieCatalogWhere,
  yearOptionsWhere,
} from "@/lib/catalog";
import { movieTitleYearOrder, pathWithQuery } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const genre = typeof params.genre === "string" ? params.genre : "";
  const yearRaw = typeof params.year === "string" ? params.year : "";
  const year = yearRaw ? Number(yearRaw) : undefined;
  const personId = typeof params.person === "string" ? params.person : "";
  const focusId = typeof params.focus === "string" ? params.focus : "";
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const catalog = {
    query: query || undefined,
    genre: genre || undefined,
    year: year && Number.isFinite(year) ? year : undefined,
    person: personId || undefined,
    signedIn,
  };

  const [movies, genres, years, selectedPerson] = await Promise.all([
    prisma.movie.findMany({
      where: movieCatalogWhere(catalog),
      orderBy: movieTitleYearOrder,
      include: { videoFiles: { select: { resolutionClass: true } } },
    }),
    prisma.genre.findMany({
      where: genreOptionsWhere(catalog),
      orderBy: { name: "asc" },
    }),
    prisma.movie.findMany({
      where: yearOptionsWhere(catalog),
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
    personId
      ? prisma.person.findUnique({
          where: { id: personId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  const yearOptions = years
    .map((item) => item.year)
    .filter((value): value is number => value != null);
  const from = pathWithQuery("/", {
    q: query || undefined,
    genre: genre || undefined,
    year: yearRaw || undefined,
    person: selectedPerson?.id,
  });

  return (
    <>
      <Header query={query} genre={genre} year={yearRaw} personId={personId} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {movies.length} {movies.length === 1 ? "movie" : "movies"}
              {selectedPerson ? ` · ${selectedPerson.name}` : ""}
            </p>
          </div>
        </div>

        <Filters
          genres={genres}
          years={yearOptions}
          selectedGenre={genre}
          selectedYear={yearRaw}
          query={query}
          personId={selectedPerson?.id}
          personName={selectedPerson?.name}
        />

        {movies.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
            <p className="text-zinc-300">No movies yet.</p>
            <p className="mt-2 text-sm text-zinc-500">
              {signedIn
                ? "Ask an administrator to scan a folder and match files on TMDB."
                : "Sign in as admin to scan a folder and match files on TMDB."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {movies.map((movie) => (
              <li key={movie.id} id={`movie-${movie.id}`} className="scroll-mt-8">
                <MovieCard movie={movie} highlighted={movie.id === focusId} from={from} />
              </li>
            ))}
          </ul>
        )}
      </main>
      {focusId ? <CatalogScrollTo movieId={focusId} /> : null}
      <Footer />
    </>
  );
}

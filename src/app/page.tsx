import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MovieCard } from "@/components/MovieCard";
import { Filters } from "@/components/Filters";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const genre = typeof params.genre === "string" ? params.genre : "";
  const yearRaw = typeof params.year === "string" ? params.year : "";
  const year = yearRaw ? Number(yearRaw) : undefined;

  const [movies, genres, years] = await Promise.all([
    prisma.movie.findMany({
      where: {
        AND: [
          query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  {
                    videoFiles: {
                      some: { title: { contains: query, mode: "insensitive" } },
                    },
                  },
                ],
              }
            : {},
          genre ? { genres: { some: { id: genre } } } : {},
          year ? { year } : {},
          { hidden: false },
        ],
      },
      orderBy: { title: "asc" },
      include: { videoFiles: { select: { resolutionClass: true } } },
    }),
    prisma.genre.findMany({
      where: { movies: { some: { hidden: false } } },
      orderBy: { name: "asc" },
    }),
    prisma.movie.findMany({
      where: { hidden: false, year: { not: null } },
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    }),
  ]);

  const yearOptions = years
    .map((item) => item.year)
    .filter((value): value is number => value != null);

  return (
    <>
      <Header query={query} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {movies.length} {movies.length === 1 ? "movie" : "movies"}
            </p>
          </div>
        </div>

        <Filters
          genres={genres}
          years={yearOptions}
          selectedGenre={genre}
          selectedYear={yearRaw}
          query={query}
        />

        {movies.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
            <p className="text-zinc-300">No movies yet.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Sign in as admin to scan a folder and match files on TMDB.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {movies.map((movie) => (
              <li key={movie.id}>
                <MovieCard movie={movie} />
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}

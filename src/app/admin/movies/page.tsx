import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { MovieAdminButtons } from "@/components/MovieAdminButtons";

export const dynamic = "force-dynamic";

export default async function AdminMoviesPage({ searchParams }: PageProps<"/admin/movies">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const movies = await prisma.movie.findMany({
    where: query ? { title: { contains: query, mode: "insensitive" } } : {},
    orderBy: { title: "asc" },
    include: { _count: { select: { videoFiles: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <AdminNav current="movies" />
      <h1 className="text-2xl font-semibold">Library</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Hide a title from the public catalog, edit its details, or remove it from the database.
        Files on disk are never deleted.
      </p>

      <form className="mt-6 mb-6" action="/admin/movies">
        <label className="sr-only" htmlFor="library-search">
          Search library
        </label>
        <input
          id="library-search"
          name="q"
          defaultValue={query}
          placeholder="Search titles…"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400"
        />
      </form>

      {movies.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
          No movies in the library yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {movies.map((movie) => (
            <li key={movie.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
              <div>
                <Link href={`/movies/${movie.id}`} className="font-medium text-zinc-100 hover:text-amber-300">
                  {movie.title}
                </Link>
                <p className="text-xs text-zinc-500">
                  {[movie.year, `${movie._count.videoFiles} file(s)`, movie.hidden ? "Hidden" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <MovieAdminButtons movieId={movie.id} hidden={movie.hidden} title={movie.title} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

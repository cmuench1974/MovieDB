import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { EditMovieForm } from "@/components/EditMovieForm";
import { MovieAdminButtons } from "@/components/MovieAdminButtons";
import { buildVersionViews, defaultVersionId } from "@/lib/movie-view";

export const dynamic = "force-dynamic";

export default async function EditMoviePage({
  params,
  searchParams,
}: PageProps<"/admin/movies/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requestedVersion = typeof query.v === "string" ? query.v : null;
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: { videoFiles: { orderBy: { filename: "asc" } } },
  });
  if (!movie) notFound();

  const versions = buildVersionViews(movie, movie.videoFiles);
  const selectedId = defaultVersionId(movie.videoFiles, requestedVersion);
  const selected = versions.find((item) => item.id === selectedId) ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <AdminNav current="movies" />
      <p className="text-sm text-zinc-400">
        <Link href="/admin/movies" className="hover:text-zinc-200">
          Library
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Edit {selected?.title ?? movie.title}</h1>
      <div className="mt-4 mb-8">
        <MovieAdminButtons
          movieId={movie.id}
          hidden={movie.hidden}
          title={selected?.title ?? movie.title}
          versionId={selected?.id}
        />
      </div>

      {versions.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {versions.map((item) => (
            <Link
              key={item.id}
              href={`/admin/movies/${movie.id}?v=${item.id}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                item.id === selected?.id
                  ? "border-amber-400 bg-amber-400/15 text-amber-200"
                  : "border-zinc-700 text-zinc-300 hover:border-amber-400"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <EditMovieForm
        movieId={movie.id}
        tmdbId={movie.tmdbId}
        fileId={selected?.id ?? null}
        title={selected?.title ?? movie.title}
        year={selected?.year ?? movie.year}
        overview={selected?.overview ?? movie.overview}
        version={selected}
        versionCount={versions.length}
      />
    </main>
  );
}

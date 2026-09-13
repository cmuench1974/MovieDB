import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { EditMovieForm } from "@/components/EditMovieForm";
import { MovieAdminButtons } from "@/components/MovieAdminButtons";
import { MovieArtPicker } from "@/components/MovieArtPicker";
import { RefreshMetadataButton } from "@/components/RefreshMetadataButton";
import { buildVersionViews, defaultVersionId } from "@/lib/movie-view";
import { getMovieImages } from "@/lib/tmdb";

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
  const images = await getMovieImages(movie.tmdbId).catch(() => ({
    posters: [],
    backdrops: [],
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <AdminNav current="movies" />
      <h1 className="text-2xl font-semibold">Edit {selected?.title ?? movie.title}</h1>
      <div className="mt-4 mb-8 flex flex-wrap items-start gap-3">
        <MovieAdminButtons
          movieId={movie.id}
          hidden={movie.hidden}
          title={selected?.title ?? movie.title}
          versionId={selected?.id}
          showEdit={false}
        />
        <RefreshMetadataButton movieId={movie.id} />
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

      <div className="mt-8">
        <MovieArtPicker
          movieId={movie.id}
          posterPath={movie.posterPath}
          backdropPath={movie.backdropPath}
          posters={images.posters}
          backdrops={images.backdrops}
        />
      </div>
    </main>
  );
}

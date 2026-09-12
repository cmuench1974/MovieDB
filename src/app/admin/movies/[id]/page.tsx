import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { EditMovieForm } from "@/components/EditMovieForm";
import { MovieAdminButtons } from "@/components/MovieAdminButtons";

export const dynamic = "force-dynamic";

export default async function EditMoviePage({ params }: PageProps<"/admin/movies/[id]">) {
  const { id } = await params;
  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <AdminNav current="movies" />
      <p className="text-sm text-zinc-400">
        <Link href="/admin/movies" className="hover:text-zinc-200">
          Library
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Edit {movie.title}</h1>
      <div className="mt-4 mb-8">
        <MovieAdminButtons movieId={movie.id} hidden={movie.hidden} title={movie.title} />
      </div>
      <EditMovieForm
        movie={{
          id: movie.id,
          title: movie.title,
          year: movie.year,
          overview: movie.overview,
          tmdbId: movie.tmdbId,
        }}
      />
    </main>
  );
}

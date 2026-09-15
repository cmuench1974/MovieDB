import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ListForm } from "@/components/ListForm";
import { requireUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { listDirectoryUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function NewListPage({ searchParams }: PageProps<"/lists/new">) {
  const session = await requireUser();
  const [users, query] = await Promise.all([
    listDirectoryUsers(session.user.id),
    searchParams,
  ]);
  const movieId = typeof query.movieId === "string" ? query.movieId : "";
  const movie = movieId
    ? await prisma.movie.findUnique({
        where: { id: movieId },
        select: { id: true, title: true, year: true },
      })
    : null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <p className="text-sm text-zinc-400">
          <Link href="/lists" className="hover:text-zinc-200">
            Lists
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">New list</h1>
        {movie ? (
          <p className="mt-2 text-sm text-zinc-400">
            {movie.title}
            {movie.year ? ` (${movie.year})` : ""} will be added to this list.
          </p>
        ) : null}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <ListForm users={users} movieId={movie?.id} />
        </div>
      </main>
      <Footer />
    </>
  );
}

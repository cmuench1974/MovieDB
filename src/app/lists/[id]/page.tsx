import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ListForm } from "@/components/ListForm";
import { MovieCard } from "@/components/MovieCard";
import { requireUser } from "@/lib/admin";
import { DeleteListButton } from "@/components/DeleteListButton";
import { removeMovieFromListAction } from "@/app/lists/actions";
import { getAccessibleList } from "@/lib/lists";
import { listDirectoryUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({ params }: PageProps<"/lists/[id]">) {
  const [{ id }, session] = await Promise.all([params, requireUser()]);
  const list = await getAccessibleList(id, session.user.id);
  if (!list) notFound();

  const isOwner = list.ownerId === session.user.id;
  const users = isOwner ? await listDirectoryUsers(session.user.id) : [];

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <p className="text-sm text-zinc-400">
          <Link href="/lists" className="hover:text-zinc-200">
            Lists
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{list.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {isOwner ? "Your list" : `Shared by ${list.owner.username}`}
            </p>
          </div>
          {isOwner ? <DeleteListButton listId={list.id} name={list.name} /> : null}
        </div>

        {list.comment ? (
          <p className="mt-6 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-zinc-300">
            {list.comment}
          </p>
        ) : null}

        <section className="mt-8">
          <h2 className="text-lg font-medium">Movies</h2>
          {list.items.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              No movies yet. Open a title and use Add to list.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {list.items.map((item) => (
                <li key={item.id} className="relative">
                  <MovieCard movie={item.movie} />
                  {isOwner ? (
                    <form
                      action={removeMovieFromListAction.bind(null, list.id, item.movieId)}
                      className="mt-2"
                    >
                      <button type="submit" className="text-xs text-zinc-500 hover:text-red-300">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isOwner ? (
          <section className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-medium">Edit list</h2>
            <p className="mt-1 mb-4 text-sm text-zinc-400">
              Change the name, comment, or who can see this list.
            </p>
            <ListForm
              users={users}
              list={{
                id: list.id,
                name: list.name,
                comment: list.comment,
                sharedUserIds: list.shares.map((share) => share.userId),
              }}
            />
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}

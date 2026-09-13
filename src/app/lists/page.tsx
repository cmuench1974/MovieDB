import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { requireUser } from "@/lib/admin";
import { listListsForUser } from "@/lib/lists";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const session = await requireUser();
  const { owned, shared } = await listListsForUser(session.user.id);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Lists</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Collect titles, add a comment, and share a list with other users.
            </p>
          </div>
          <Link
            href="/lists/new"
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-300"
          >
            New list
          </Link>
        </div>

        <section>
          <h2 className="text-lg font-medium">Your lists</h2>
          {owned.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">You have not created any lists yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {owned.map((list) => (
                <li key={list.id}>
                  <Link
                    href={`/lists/${list.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-900"
                  >
                    <span className="font-medium text-zinc-100">{list.name}</span>
                    <span className="text-xs text-zinc-500">
                      {list._count.items} {list._count.items === 1 ? "movie" : "movies"}
                      {list._count.shares > 0 ? ` · shared with ${list._count.shares}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">Shared with you</h2>
          {shared.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No one has shared a list with you yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
              {shared.map((list) => (
                <li key={list.id}>
                  <Link
                    href={`/lists/${list.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-900"
                  >
                    <span>
                      <span className="font-medium text-zinc-100">{list.name}</span>
                      <span className="ml-2 text-xs text-zinc-500">by {list.owner.username}</span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      {list._count.items} {list._count.items === 1 ? "movie" : "movies"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

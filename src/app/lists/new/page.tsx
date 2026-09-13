import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ListForm } from "@/components/ListForm";
import { requireUser } from "@/lib/admin";
import { listDirectoryUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function NewListPage() {
  const session = await requireUser();
  const users = await listDirectoryUsers(session.user.id);

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
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <ListForm users={users} />
        </div>
      </main>
      <Footer />
    </>
  );
}

import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { UserCreateForm } from "@/components/UserCreateForm";
import { auth } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [session, users] = await Promise.all([
    auth(),
    prisma.user.findMany({ orderBy: { username: "asc" } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <AdminNav current="users" />
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Create accounts for administrators and regular users. Welcome emails are sent when SMTP is
        configured. You can attach a role-specific site guide.
      </p>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Create user</h2>
        <div className="mt-4">
          <UserCreateForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-medium">Accounts</h2>
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-zinc-100">{user.username}</p>
                <p className="text-xs text-zinc-500">
                  {[
                    user.email,
                    user.role === "admin" ? "Administrator" : "User",
                    user.notifyNewMovies ? "New-movie emails" : null,
                    user.id === session?.user.id ? "You" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Link
                href={`/admin/users/${user.id}`}
                className="text-sm text-amber-400 hover:text-amber-300"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

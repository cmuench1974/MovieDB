import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { UserEditForm } from "@/components/UserEditForm";
import { auth } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <AdminNav current="users" />
      <p className="text-sm text-zinc-400">
        <Link href="/admin/users" className="hover:text-zinc-200">
          Users
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Edit {user.username}</h1>
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <UserEditForm user={user} canDelete={user.id !== session?.user.id} />
      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AccountSettingsForm } from "@/components/AccountSettingsForm";
import { requireUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, email: true, role: true, notifyNewMovies: true },
  });
  if (!user) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="mt-1 mb-8 text-sm text-zinc-400">
          Change notification emails, your login email, or your password. You can also delete this
          account.
        </p>
        <AccountSettingsForm user={user} />
      </main>
      <Footer />
    </>
  );
}

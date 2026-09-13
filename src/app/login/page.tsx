import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";

  return (
    <>
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-2 mb-6 text-sm text-zinc-400">
            The catalog can be viewed without an account. Sign in to see hidden titles and to create
            lists.
          </p>
          <LoginForm callbackUrl={callbackUrl} />
          <p className="mt-6 text-center text-sm">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200">
              Back to catalog
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

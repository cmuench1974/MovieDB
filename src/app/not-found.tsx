import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-zinc-400">This page or movie does not exist.</p>
        <Link href="/" className="mt-6 text-sm text-amber-400 hover:text-amber-300">
          Back to catalog
        </Link>
      </main>
      <Footer />
    </>
  );
}

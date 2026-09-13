import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/app/admin/actions";
import { SearchBox } from "./SearchBox";

export async function Header({ query = "" }: { query?: string }) {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight text-zinc-100">
          Movie<span className="text-amber-400">DB</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SearchBox defaultValue={query} />
          {user ? (
            <nav className="flex shrink-0 items-center gap-3 text-sm">
              <Link href="/lists" className="text-zinc-300 hover:text-amber-300">
                Lists
              </Link>
              {user.role === "admin" ? (
                <Link href="/admin" className="text-zinc-300 hover:text-amber-300">
                  Admin
                </Link>
              ) : null}
              <span className="hidden text-zinc-500 sm:inline">{user.username}</span>
              <form action={logoutAction}>
                <button type="submit" className="text-zinc-400 hover:text-zinc-200">
                  Sign out
                </button>
              </form>
            </nav>
          ) : (
            <Link
              href="/login"
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-400"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

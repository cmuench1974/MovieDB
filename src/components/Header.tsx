import Link from "next/link";
import { SearchBox } from "./SearchBox";

export function Header({ query = "" }: { query?: string }) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight text-zinc-100">
          Movie<span className="text-amber-400">DB</span>
        </Link>
        <SearchBox defaultValue={query} />
      </div>
    </header>
  );
}

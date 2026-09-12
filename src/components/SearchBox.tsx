"use client";

import { useRouter } from "next/navigation";

export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();

  return (
    <form
      className="flex-1"
      action="/"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const q = String(data.get("q") ?? "").trim();
        router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
      }}
    >
      <label className="sr-only" htmlFor="catalog-search">
        Search movies
      </label>
      <input
        id="catalog-search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search titles…"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
      />
    </form>
  );
}

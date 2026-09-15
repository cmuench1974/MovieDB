"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { pathWithQuery } from "@/lib/navigation";

type GenreOption = { id: string; name: string };

export function Filters({
  genres,
  years,
  selectedGenre,
  selectedYear,
  query,
  personId,
  personName,
}: {
  genres: GenreOption[];
  years: number[];
  selectedGenre?: string;
  selectedYear?: string;
  query?: string;
  personId?: string;
  personName?: string;
}) {
  const router = useRouter();

  function apply(next: { genre?: string; year?: string; person?: string; q?: string }) {
    const genre = next.genre !== undefined ? next.genre : selectedGenre ?? "";
    const year = next.year !== undefined ? next.year : selectedYear ?? "";
    const person = next.person !== undefined ? next.person : personId ?? "";
    const q = next.q !== undefined ? next.q : query ?? "";
    router.push(
      pathWithQuery("/", {
        q: q || undefined,
        genre: genre || undefined,
        year: year || undefined,
        person: person || undefined,
      }),
    );
  }

  return (
    <div className="mb-8 flex flex-wrap items-end gap-3">
      <label className="text-sm text-zinc-400">
        Genre
        <select
          name="genre"
          value={selectedGenre ?? ""}
          onChange={(event) => apply({ genre: event.target.value })}
          className="mt-1 block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">All</option>
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-zinc-400">
        Year
        <select
          name="year"
          value={selectedYear ?? ""}
          onChange={(event) => apply({ year: event.target.value })}
          className="mt-1 block rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">All</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      {personId && personName ? (
        <button
          type="button"
          onClick={() => apply({ person: "" })}
          className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-400/20"
        >
          {personName} ×
        </button>
      ) : null}

      {selectedGenre || selectedYear || query || personId ? (
        <Link href="/" className="px-2 py-2 text-sm text-zinc-400 hover:text-zinc-200">
          Reset
        </Link>
      ) : null}
    </div>
  );
}

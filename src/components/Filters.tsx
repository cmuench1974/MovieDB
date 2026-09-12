import Link from "next/link";

type GenreOption = { id: string; name: string };

export function Filters({
  genres,
  years,
  selectedGenre,
  selectedYear,
  query,
}: {
  genres: GenreOption[];
  years: number[];
  selectedGenre?: string;
  selectedYear?: string;
  query?: string;
}) {
  return (
    <form className="mb-8 flex flex-wrap items-end gap-3" action="/">
      {query ? <input type="hidden" name="q" value={query} /> : null}

      <label className="text-sm text-zinc-400">
        Genre
        <select
          name="genre"
          defaultValue={selectedGenre ?? ""}
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
          defaultValue={selectedYear ?? ""}
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

      <button
        type="submit"
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
      >
        Filter
      </button>

      {selectedGenre || selectedYear || query ? (
        <Link href="/" className="px-2 py-2 text-sm text-zinc-400 hover:text-zinc-200">
          Reset
        </Link>
      ) : null}
    </form>
  );
}

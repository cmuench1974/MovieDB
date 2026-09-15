"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { pathWithQuery } from "@/lib/navigation";
import type { SuggestPerson, SuggestResult } from "@/lib/suggest";

type Props = {
  defaultValue: string;
  genre?: string;
  year?: string;
  personId?: string;
};

export function SearchBox({ defaultValue, genre, year, personId }: Props) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<SuggestResult>({ movies: [], people: [] });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setResults({ movies: [], people: [] });
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const params = new URLSearchParams({ q });
      if (genre) params.set("genre", genre);
      if (year) params.set("year", year);
      if (personId) params.set("person", personId);
      fetch(`/api/suggest?${params}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: SuggestResult | null) => {
          if (!data) return;
          setResults(data);
          setActive(0);
          setOpen(data.movies.length + data.people.length > 0);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [value, genre, year, personId]);

  const items = [
    ...results.people.map((person) => ({ kind: "person" as const, person })),
    ...results.movies.map((movie) => ({ kind: "movie" as const, movie })),
  ];

  function applyPerson(person: SuggestPerson) {
    setOpen(false);
    setValue("");
    router.push(pathWithQuery("/", {
      genre: genre || undefined,
      year: year || undefined,
      person: person.id,
    }));
  }

  function applyMovieTitle(title: string) {
    setOpen(false);
    setValue(title);
    router.push(
      pathWithQuery("/", {
        q: title,
        genre: genre || undefined,
        year: year || undefined,
      }),
    );
  }

  function submitQuery() {
    const q = value.trim();
    setOpen(false);
    router.push(pathWithQuery("/", {
      q: q || undefined,
      genre: genre || undefined,
      year: year || undefined,
    }));
  }

  return (
    <form
      className="relative flex-1"
      action="/"
      onSubmit={(event) => {
        event.preventDefault();
        const item = items[active];
        if (open && item?.kind === "person") {
          applyPerson(item.person);
          return;
        }
        if (open && item?.kind === "movie") {
          applyMovieTitle(item.movie.title);
          return;
        }
        submitQuery();
      }}
    >
      <label className="sr-only" htmlFor="catalog-search">
        Search movies
      </label>
      <input
        id="catalog-search"
        name="q"
        value={value}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        placeholder="Search titles, actors, directors…"
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(event) => {
          if (!open || items.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((current) => (current + 1) % items.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => (current - 1 + items.length) % items.length);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400"
      />
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl"
        >
          {items.map((item, index) => {
            const selected = index === active;
            if (item.kind === "person") {
              const label = item.person.roles.includes("director")
                ? item.person.roles.includes("actor")
                  ? "Director / actor"
                  : "Director"
                : "Actor";
              return (
                <li key={`p-${item.person.id}`} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ${
                      selected ? "bg-zinc-800 text-amber-200" : "text-zinc-100 hover:bg-zinc-900"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyPerson(item.person)}
                  >
                    <span>{item.person.name}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{label}</span>
                  </button>
                </li>
              );
            }
            return (
              <li key={`m-${item.movie.id}`} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ${
                    selected ? "bg-zinc-800 text-amber-200" : "text-zinc-100 hover:bg-zinc-900"
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyMovieTitle(item.movie.title)}
                >
                  <span>{item.movie.title}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {item.movie.year ?? "Title"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </form>
  );
}

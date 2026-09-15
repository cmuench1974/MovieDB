import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { movieCatalogWhere, type CatalogParams } from "./catalog";

export type SuggestMovie = {
  type: "movie";
  id: string;
  title: string;
  year: number | null;
};

export type SuggestPerson = {
  type: "person";
  id: string;
  name: string;
  roles: ("director" | "actor")[];
};

export type SuggestResult = {
  movies: SuggestMovie[];
  people: SuggestPerson[];
};

const LIMIT = 6;

/** Prefix/contains, kleine Limits — Katalog bleibt unangetastet. */
export async function catalogSuggestions(
  query: string,
  filters: Omit<CatalogParams, "query">,
): Promise<SuggestResult> {
  const q = query.trim();
  if (q.length < 2) return { movies: [], people: [] };

  const movieWhere = movieCatalogWhere({ ...filters, query: undefined });
  const titleFilter: Prisma.StringFilter = { startsWith: q, mode: "insensitive" };
  const nameFilter: Prisma.PersonWhereInput = {
    OR: [
      { name: { startsWith: q, mode: "insensitive" } },
      { name: { contains: ` ${q}`, mode: "insensitive" } },
    ],
  };

  const [movies, people] = await Promise.all([
    prisma.movie.findMany({
      where: { AND: [movieWhere, { title: titleFilter }] },
      select: { id: true, title: true, year: true },
      orderBy: { title: "asc" },
      take: LIMIT,
    }),
    prisma.person.findMany({
      where: {
        AND: [nameFilter, { credits: { some: { movie: movieWhere } } }],
      },
      select: {
        id: true,
        name: true,
        credits: {
          where: { movie: movieWhere },
          select: { role: true },
          take: 24,
        },
      },
      orderBy: { name: "asc" },
      take: LIMIT,
    }),
  ]);

  return {
    movies: movies.map((movie) => ({
      type: "movie" as const,
      id: movie.id,
      title: movie.title,
      year: movie.year,
    })),
    people: people.map((person) => ({
      type: "person" as const,
      id: person.id,
      name: person.name,
      roles: [...new Set(person.credits.map((credit) => credit.role))].map((role) =>
        role === "director" ? "director" : "actor",
      ),
    })),
  };
}

import type { Prisma } from "@prisma/client";

export type CatalogParams = {
  query?: string;
  genre?: string;
  year?: number;
  person?: string;
  signedIn: boolean;
};

function visibility(signedIn: boolean): Prisma.MovieWhereInput {
  return signedIn ? {} : { hidden: false };
}

function queryFilter(query: string | undefined): Prisma.MovieWhereInput {
  if (!query) return {};
  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { directorName: { contains: query, mode: "insensitive" } },
      {
        videoFiles: {
          some: { title: { contains: query, mode: "insensitive" } },
        },
      },
      {
        credits: {
          some: { person: { name: { contains: query, mode: "insensitive" } } },
        },
      },
    ],
  };
}

/** Gemeinsame Katalog-Filter, damit Suche und Dropdowns dieselbe Menge meinen. */
export function movieCatalogWhere(input: CatalogParams): Prisma.MovieWhereInput {
  return {
    AND: [
      visibility(input.signedIn),
      queryFilter(input.query),
      input.genre ? { genres: { some: { id: input.genre } } } : {},
      input.year ? { year: input.year } : {},
      input.person ? { credits: { some: { personId: input.person } } } : {},
    ],
  };
}

/** Genre-Liste: aktuelles Genre nicht mitfiltern, sonst verschwindet die Auswahl. */
export function genreOptionsWhere(input: CatalogParams): Prisma.GenreWhereInput {
  return {
    movies: {
      some: movieCatalogWhere({ ...input, genre: undefined }),
    },
  };
}

export function yearOptionsWhere(input: CatalogParams): Prisma.MovieWhereInput {
  return {
    ...movieCatalogWhere({ ...input, year: undefined }),
    year: { not: null },
  };
}

import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getMovieDetails,
  yearFromReleaseDate,
  type TmdbCastMember,
  type TmdbMovieDetails,
} from "./tmdb";

export async function upsertMovieFromTmdb(tmdbId: number) {
  const existing = await prisma.movie.findUnique({
    where: { tmdbId },
    include: { genres: true },
  });
  if (existing) return existing;
  return createMovieFromTmdb(tmdbId);
}

export async function createMovieFromTmdb(tmdbId: number) {
  const details = await getMovieDetails(tmdbId);
  const cast = snapshotCast(details);

  return prisma.movie.create({
    data: {
      tmdbId: details.id,
      title: details.title,
      originalTitle: details.original_title,
      year: yearFromReleaseDate(details.release_date),
      overview: details.overview,
      runtime: details.runtime,
      voteAverage: details.vote_average,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate: details.release_date,
      cast: cast as unknown as Prisma.InputJsonValue,
      genres: {
        connectOrCreate: details.genres.map((genre) => ({
          where: { tmdbId: genre.id },
          create: { tmdbId: genre.id, name: genre.name },
        })),
      },
    },
    include: { genres: true },
  });
}

export async function applyTmdbDetailsToMovie(movieId: string, tmdbId: number) {
  const details = await getMovieDetails(tmdbId);
  const genres = await Promise.all(
    details.genres.map((genre) =>
      prisma.genre.upsert({
        where: { tmdbId: genre.id },
        create: { tmdbId: genre.id, name: genre.name },
        update: { name: genre.name },
      }),
    ),
  );

  return prisma.movie.update({
    where: { id: movieId },
    data: {
      tmdbId: details.id,
      title: details.title,
      originalTitle: details.original_title,
      year: yearFromReleaseDate(details.release_date),
      overview: details.overview,
      runtime: details.runtime,
      voteAverage: details.vote_average,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate: details.release_date,
      cast: snapshotCast(details) as unknown as Prisma.InputJsonValue,
      genres: { set: genres.map((genre) => ({ id: genre.id })) },
    },
  });
}

function snapshotCast(details: TmdbMovieDetails): TmdbCastMember[] {
  return (details.credits?.cast ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((member) => ({
      name: member.name,
      character: member.character,
      profile_path: member.profile_path,
    }));
}

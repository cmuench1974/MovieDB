import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getMovieDetails,
  getMovieImages,
  yearFromReleaseDate,
  type TmdbCastMember,
  type TmdbMovieDetails,
} from "./tmdb";
import {
  beginScan,
  endScan,
  ScanStopped,
  updateScanProgress,
  yieldScanControl,
} from "./scan-state";
import { directorNameFromDetails, syncMovieCredits } from "./credits";

export async function upsertMovieFromTmdb(tmdbId: number) {
  const existing = await prisma.movie.findUnique({
    where: { tmdbId },
    include: { genres: true },
  });
  if (existing) return { movie: existing, created: false };
  const movie = await createMovieFromTmdb(tmdbId);
  return { movie, created: true };
}

export async function createMovieFromTmdb(tmdbId: number) {
  const details = await getMovieDetails(tmdbId);
  const cast = snapshotCast(details);

  const movie = await prisma.movie.create({
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
      directorName: directorNameFromDetails(details),
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
  await syncMovieCredits(movie.id, details);
  return movie;
}

export async function applyTmdbDetailsToMovie(
  movieId: string,
  tmdbId: number,
  options: { includeImages?: boolean } = {},
) {
  const includeImages = options.includeImages ?? true;
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

  const movie = await prisma.movie.update({
    where: { id: movieId },
    data: {
      tmdbId: details.id,
      title: details.title,
      originalTitle: details.original_title,
      year: yearFromReleaseDate(details.release_date),
      overview: details.overview,
      runtime: details.runtime,
      voteAverage: details.vote_average,
      ...(includeImages
        ? { posterPath: details.poster_path, backdropPath: details.backdrop_path }
        : {}),
      releaseDate: details.release_date,
      directorName: directorNameFromDetails(details),
      cast: snapshotCast(details) as unknown as Prisma.InputJsonValue,
      genres: { set: genres.map((genre) => ({ id: genre.id })) },
    },
  });
  await syncMovieCredits(movie.id, details);
  return movie;
}

/** Aktualisiert TMDB-Texte/Cast, lässt ein manuell gewähltes Poster/Backdrop stehen. */
export async function refreshMovieMetadata(movieId: string) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) throw new Error("Movie not found.");
  return applyTmdbDetailsToMovie(movie.id, movie.tmdbId, { includeImages: false });
}

export async function setMovieArt(
  movieId: string,
  kind: "poster" | "backdrop",
  path: string,
) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId } });
  if (!movie) throw new Error("Movie not found.");

  const images = await getMovieImages(movie.tmdbId);
  const allowed = (kind === "poster" ? images.posters : images.backdrops).map(
    (item) => item.file_path,
  );
  if (path !== movie.posterPath && path !== movie.backdropPath && !allowed.includes(path)) {
    throw new Error("That image is not available for this title on TMDB.");
  }

  return prisma.movie.update({
    where: { id: movieId },
    data: kind === "poster" ? { posterPath: path } : { backdropPath: path },
  });
}

export function startMetadataRefresh(): { started: boolean; error?: string } {
  if (!beginScan("metadata")) {
    return { started: false, error: "A scan or metadata update is already running." };
  }
  void executeMetadataRefresh();
  return { started: true };
}

async function executeMetadataRefresh(): Promise<void> {
  const movies = await prisma.movie.findMany({
    orderBy: { title: "asc" },
    select: { id: true, tmdbId: true, title: true },
  });

  let processed = 0;
  let matched = 0;
  let skipped = 0;

  try {
    updateScanProgress({
      status: "running",
      phase: "metadata",
      kind: "metadata",
      filesFound: movies.length,
      processed: 0,
      matched: 0,
      skipped: 0,
      currentFile: null,
    });

    for (const movie of movies) {
      await yieldScanControl();
      processed += 1;
      updateScanProgress({
        processed,
        currentFile: movie.title,
        filesFound: movies.length,
        matched,
        skipped,
      });
      try {
        await applyTmdbDetailsToMovie(movie.id, movie.tmdbId, { includeImages: false });
        matched += 1;
      } catch (error) {
        skipped += 1;
        console.error(`Could not refresh metadata for ${movie.title}:`, error);
      }
      updateScanProgress({ matched, skipped, processed });
      await pacedMetadataDelay();
    }

    updateScanProgress({
      status: "completed",
      phase: "idle",
      currentFile: null,
      filesFound: movies.length,
      processed,
      matched,
      skipped,
    });
  } catch (error) {
    if (error instanceof ScanStopped) {
      updateScanProgress({
        status: "cancelled",
        phase: "idle",
        currentFile: null,
        filesFound: movies.length,
        processed,
        matched,
        skipped,
        error: "Metadata update stopped.",
      });
      return;
    }
    updateScanProgress({
      status: "failed",
      phase: "idle",
      currentFile: null,
      filesFound: movies.length,
      processed,
      matched,
      skipped,
      error: error instanceof Error ? error.message : "Metadata update failed.",
    });
  } finally {
    endScan();
  }
}

async function pacedMetadataDelay() {
  const until = Date.now() + 250;
  while (Date.now() < until) {
    await yieldScanControl();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
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

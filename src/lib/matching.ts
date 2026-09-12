import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { discoverVideoFiles } from "./scanner";
import { normalizeTitle } from "./filename";
import {
  beginScan,
  endScan,
  ScanStopped,
  updateScanProgress,
  yieldScanControl,
} from "./scan-state";
import {
  getMovieDetails,
  parseTmdbMovieId,
  searchMovies,
  yearFromReleaseDate,
  type TmdbCandidate,
  type TmdbCastMember,
  type TmdbMovieDetails,
} from "./tmdb";

const SEARCH_DELAY_MS = 250;

export function startScan(): { started: boolean; error?: string } {
  if (!beginScan()) {
    return { started: false, error: "A scan is already running." };
  }
  void executeScan();
  return { started: true };
}

async function executeScan(): Promise<void> {
  const job = await prisma.scanJob.create({
    data: { status: "running" },
  });

  let filesFound = 0;
  let processed = 0;
  let matched = 0;
  let needsReview = 0;
  let skipped = 0;

  try {
    updateScanProgress({ status: "running", phase: "listing", currentFile: null });
    const { files, errors } = await discoverVideoFiles();
    filesFound = files.length;
    updateScanProgress({
      phase: "matching",
      filesFound,
      folderErrors: errors,
    });

    for (const file of files) {
      await yieldScanControl();
      processed += 1;
      updateScanProgress({
        processed,
        currentFile: file.filename,
        filesFound,
        matched,
        needsReview,
        skipped,
      });

      const existing = await prisma.videoFile.findUnique({
        where: { path: file.path },
      });

      const video = await prisma.videoFile.upsert({
        where: { path: file.path },
        create: {
          path: file.path,
          filename: file.filename,
          size: file.size,
          parsedTitle: file.parsed.title,
          parsedYear: file.parsed.year,
          status: "pending",
          folderId: file.folderId,
        },
        update: {
          filename: file.filename,
          size: file.size,
          parsedTitle: file.parsed.title,
          parsedYear: file.parsed.year,
          lastSeenAt: new Date(),
          folderId: file.folderId,
        },
      });

      // Already resolved files are left as-is on later scans.
      if (
        existing &&
        (existing.status === "matched" || existing.status === "ignored")
      ) {
        skipped += 1;
        updateScanProgress({ skipped, processed });
        continue;
      }

      const result = await matchFromFilename(video.id, file.parsed.title, file.parsed.year);
      if (result === "matched") matched += 1;
      else if (result === "needs_review") needsReview += 1;
      else skipped += 1;

      updateScanProgress({ matched, needsReview, skipped, processed });
      await pacedDelay();
    }

    const errorMessage = errors.length ? errors.join(" ") : undefined;
    const status = errors.length && filesFound === 0 ? "failed" : "completed";

    await prisma.scanJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: new Date(),
        filesFound,
        matched,
        needsReview,
        error: errorMessage,
      },
    });

    updateScanProgress({
      status,
      phase: "idle",
      currentFile: null,
      filesFound,
      processed,
      matched,
      needsReview,
      skipped,
      error: errorMessage,
      folderErrors: errors,
    });
  } catch (error) {
    if (error instanceof ScanStopped) {
      await prisma.scanJob.update({
        where: { id: job.id },
        data: {
          status: "cancelled",
          finishedAt: new Date(),
          filesFound,
          matched,
          needsReview,
          error: "Stopped by user.",
        },
      });
      updateScanProgress({
        status: "cancelled",
        phase: "idle",
        currentFile: null,
        filesFound,
        processed,
        matched,
        needsReview,
        skipped,
        error: "Scan stopped.",
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Scan failed.";
    await prisma.scanJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        filesFound,
        matched,
        needsReview,
        error: message,
      },
    });
    updateScanProgress({
      status: "failed",
      phase: "idle",
      currentFile: null,
      filesFound,
      processed,
      matched,
      needsReview,
      skipped,
      error: message,
    });
  } finally {
    endScan();
  }
}

async function pacedDelay() {
  const until = Date.now() + SEARCH_DELAY_MS;
  while (Date.now() < until) {
    await yieldScanControl();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function matchFileToTmdb(fileId: string, tmdbId: number) {
  const movie = await upsertMovieFromTmdb(tmdbId);
  await prisma.videoFile.update({
    where: { id: fileId },
    data: {
      status: "matched",
      movieId: movie.id,
      candidates: Prisma.DbNull,
    },
  });
  return movie;
}

export async function matchFileByUrl(fileId: string, url: string) {
  const tmdbId = parseTmdbMovieId(url);
  if (!tmdbId) {
    throw new Error(
      "Please paste a TMDB movie URL such as https://www.themoviedb.org/movie/603-the-matrix",
    );
  }
  return matchFileToTmdb(fileId, tmdbId);
}

export async function ignoreFile(fileId: string) {
  await prisma.videoFile.update({
    where: { id: fileId },
    data: { status: "ignored", movieId: null },
  });
}

async function matchFromFilename(
  fileId: string,
  title: string,
  year: number | null,
): Promise<"matched" | "needs_review" | "skipped"> {
  if (!title) {
    await prisma.videoFile.update({
      where: { id: fileId },
      data: { status: "needs_review", candidates: [] },
    });
    return "needs_review";
  }

  const candidates = await searchMovies(title, year);
  const confident = candidates.filter((item) => isHighConfidence(title, year, item));

  if (confident.length === 1) {
    await matchFileToTmdb(fileId, confident[0].id);
    return "matched";
  }

  await prisma.videoFile.update({
    where: { id: fileId },
    data: {
      status: "needs_review",
      candidates: candidates as unknown as Prisma.InputJsonValue,
    },
  });
  return "needs_review";
}

function isHighConfidence(
  parsedTitle: string,
  parsedYear: number | null,
  candidate: TmdbCandidate,
): boolean {
  const titleMatch =
    normalizeTitle(parsedTitle) === normalizeTitle(candidate.title) ||
    normalizeTitle(parsedTitle) === normalizeTitle(candidate.original_title ?? "");

  const candidateYear = yearFromReleaseDate(candidate.release_date);
  const yearMatch = !parsedYear || !candidateYear || parsedYear === candidateYear;
  return titleMatch && yearMatch;
}

async function upsertMovieFromTmdb(tmdbId: number) {
  const existing = await prisma.movie.findUnique({
    where: { tmdbId },
    include: { genres: true },
  });
  if (existing) return existing;

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

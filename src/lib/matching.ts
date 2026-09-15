import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { fillVersionEditorialFromMovie } from "./library";
import { discoverVideoFiles } from "./scanner";
import { normalizeTitle } from "./filename";
import { probeVideoIfNeeded } from "./media-probe";
import {
  beginScan,
  endScan,
  ScanStopped,
  updateScanProgress,
  yieldScanControl,
} from "./scan-state";
import { parseTmdbMovieId, searchMovies, yearFromReleaseDate, type TmdbCandidate } from "./tmdb";
import { upsertMovieFromTmdb } from "./tmdb-sync";
import { notifyUsersAboutNewMovies } from "./notify";

const SEARCH_DELAY_MS = 250;

export function startScan(mode: "full" | "new" = "full"): { started: boolean; error?: string } {
  if (!beginScan(mode)) {
    return { started: false, error: "A scan or metadata update is already running." };
  }
  void executeScan(mode === "new");
  return { started: true };
}

/** Liest bekannte Dateien neu: Name, Größe, Video/Audio/Untertitel — ohne TMDB. */
export function startMediaRefresh(): { started: boolean; error?: string } {
  if (!beginScan("media")) {
    return { started: false, error: "A scan or metadata update is already running." };
  }
  void executeMediaRefresh();
  return { started: true };
}

async function executeScan(onlyNew: boolean): Promise<void> {
  const job = await prisma.scanJob.create({
    data: { status: "running" },
  });

  let filesFound = 0;
  let processed = 0;
  let matched = 0;
  let needsReview = 0;
  let skipped = 0;
  const newMovies = new Map<string, { id: string; title: string; year: number | null }>();

  try {
    updateScanProgress({ status: "running", phase: "listing", currentFile: null });
    const { files, errors } = await discoverVideoFiles();
    const existingPaths = onlyNew
      ? new Set(
          (await prisma.videoFile.findMany({ select: { path: true } })).map((file) => file.path),
        )
      : null;
    const queue = existingPaths ? files.filter((file) => !existingPaths.has(file.path)) : files;
    filesFound = queue.length;
    updateScanProgress({
      phase: "matching",
      filesFound,
      folderErrors: errors,
    });

    for (const file of queue) {
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

      const needsProbe =
        !existing?.probedAt ||
        existing.size !== video.size ||
        Boolean(existing.probeError && !existing.probeError.includes("Disc images"));
      if (needsProbe) {
        updateScanProgress({ phase: "probing", currentFile: file.filename });
        await probeVideoIfNeeded(video.id);
        await yieldScanControl();
      }

      // Already resolved files are left as-is on later scans.
      if (
        existing &&
        (existing.status === "matched" || existing.status === "ignored")
      ) {
        skipped += 1;
        if (existing.status === "matched" && !existing.title) {
          await fillVersionEditorialFromMovie(video.id);
        }
        updateScanProgress({ phase: "matching", skipped, processed });
        continue;
      }

      updateScanProgress({ phase: "matching", currentFile: file.filename });
      const result = await matchFromFilename(video.id, file.parsed.title, file.parsed.year);
      if (result.status === "matched") {
        matched += 1;
        if (result.created && result.movie) {
          newMovies.set(result.movie.id, {
            id: result.movie.id,
            title: result.movie.title,
            year: result.movie.year,
          });
        }
      } else if (result.status === "needs_review") needsReview += 1;
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

    if (status === "completed" && newMovies.size > 0) {
      try {
        await notifyUsersAboutNewMovies([...newMovies.values()]);
      } catch (error) {
        console.error("Could not send new-movie notifications:", error);
      }
    }
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

async function executeMediaRefresh(): Promise<void> {
  const job = await prisma.scanJob.create({
    data: { status: "running" },
  });

  let filesFound = 0;
  let processed = 0;
  let matched = 0;
  let skipped = 0;

  try {
    updateScanProgress({ status: "running", phase: "listing", currentFile: null });
    const { files, errors } = await discoverVideoFiles();
    const knownPaths = new Set(
      (await prisma.videoFile.findMany({ select: { path: true } })).map((file) => file.path),
    );
    const queue = files.filter((file) => knownPaths.has(file.path));
    filesFound = queue.length;
    updateScanProgress({
      phase: "probing",
      filesFound,
      folderErrors: errors,
    });

    for (const file of queue) {
      await yieldScanControl();
      processed += 1;
      updateScanProgress({
        processed,
        currentFile: file.filename,
        filesFound,
        matched,
        skipped,
      });

      const video = await prisma.videoFile.update({
        where: { path: file.path },
        data: {
          filename: file.filename,
          size: file.size,
          lastSeenAt: new Date(),
          folderId: file.folderId,
        },
      });

      const probe = await probeVideoIfNeeded(video.id);
      const probeFailed =
        Boolean(probe?.probeError) && !probe?.probeError?.includes("Disc images");
      if (probeFailed) skipped += 1;
      else matched += 1;

      updateScanProgress({ matched, skipped, processed });
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
  const { movie, created } = await upsertMovieFromTmdb(tmdbId);
  const file = await prisma.videoFile.findUnique({ where: { id: fileId } });
  await prisma.videoFile.update({
    where: { id: fileId },
    data: {
      status: "matched",
      movieId: movie.id,
      candidates: Prisma.DbNull,
      title: file?.title || movie.title,
      year: file?.year ?? movie.year,
      overview: file?.overview || movie.overview,
    },
  });
  return { movie, created };
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
): Promise<{
  status: "matched" | "needs_review" | "skipped";
  created?: boolean;
  movie?: { id: string; title: string; year: number | null };
}> {
  if (!title) {
    await prisma.videoFile.update({
      where: { id: fileId },
      data: { status: "needs_review", candidates: [] },
    });
    return { status: "needs_review" };
  }

  const candidates = await searchMovies(title, year);
  const confident = candidates.filter((item) => isHighConfidence(title, year, item));

  if (confident.length === 1) {
    const result = await matchFileToTmdb(fileId, confident[0].id);
    return { status: "matched", created: result.created, movie: result.movie };
  }

  await prisma.videoFile.update({
    where: { id: fileId },
    data: {
      status: "needs_review",
      candidates: candidates as unknown as Prisma.InputJsonValue,
    },
  });
  return { status: "needs_review" };
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

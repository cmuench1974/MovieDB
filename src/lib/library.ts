import { Prisma, type FolderKind } from "@prisma/client";
import { prisma } from "./prisma";
import { encryptSecret } from "./secrets";
import {
  assertFolderReachable,
  isSafeLocalPath,
  isValidHost,
  isValidShare,
  parseSmbLocation,
} from "./scanner";
import { getMovieDetails, parseTmdbMovieId, yearFromReleaseDate } from "./tmdb";
import { applyTmdbDetailsToMovie, upsertMovieFromTmdb } from "./tmdb-sync";

export type FolderInput = {
  label: string;
  kind: FolderKind;
  path?: string;
  smbHost?: string;
  smbShare?: string;
  smbFolder?: string;
  smbDomain?: string;
  smbUsername?: string;
  smbPassword?: string;
};

export async function addScanFolder(input: FolderInput) {
  const label = input.label.trim();
  if (!label) throw new Error("Please enter a name for this folder.");

  if (input.kind === "local") {
    const folderPath = input.path?.trim() ?? "";
    if (!isSafeLocalPath(folderPath)) {
      throw new Error("Use an absolute path visible in the container, such as /media/movies.");
    }
    await assertFolderReachable({ kind: "local", path: folderPath });
    return prisma.scanFolder.create({
      data: { label, kind: "local", path: folderPath },
    });
  }

  let host = input.smbHost?.trim() ?? "";
  let share = input.smbShare?.trim() ?? "";
  let folder = input.smbFolder?.trim() || undefined;
  const username = input.smbUsername?.trim() ?? "";
  const password = input.smbPassword ?? "";
  const domain = input.smbDomain?.trim() || undefined;

  if (host.includes("\\") || host.includes("/") || host.toLowerCase().startsWith("smb:")) {
    const parsed = parseSmbLocation(host);
    if (parsed) {
      host = parsed.host;
      if (!share) share = parsed.share;
      folder = folder || parsed.folder;
    }
  }

  if (!isValidHost(host) || !isValidShare(share)) {
    throw new Error("Enter a valid SMB host (preferably an IP) and share name.");
  }
  if (!username && !process.env.SMB_BRIDGE_URL) {
    throw new Error("SMB username is required (use Guest for public shares).");
  }

  await assertFolderReachable({
    kind: "smb",
    smbHost: host,
    smbShare: share,
    smbFolder: folder,
    smbDomain: domain,
    smbUsername: username,
    smbPassword: password,
  });

  return prisma.scanFolder.create({
    data: {
      label,
      kind: "smb",
      smbHost: host,
      smbShare: share,
      smbFolder: folder,
      smbDomain: domain,
      smbUsername: username,
      smbPassword: password ? encryptSecret(password) : null,
    },
  });
}

export async function removeScanFolder(folderId: string) {
  const folder = await prisma.scanFolder.findUnique({ where: { id: folderId } });
  if (!folder) throw new Error("Folder not found.");

  await prisma.$transaction([
    prisma.videoFile.deleteMany({ where: { folderId } }),
    prisma.scanFolder.delete({ where: { id: folderId } }),
  ]);
}

export async function setMovieHidden(movieId: string, hidden: boolean) {
  await prisma.movie.update({ where: { id: movieId }, data: { hidden } });
}

export async function updateMovie(
  movieId: string,
  data: { title: string; year: string; overview: string },
) {
  const editorial = parseEditorial(data);
  await prisma.movie.update({
    where: { id: movieId },
    data: editorial,
  });
}

export async function fillVersionEditorialFromMovie(fileId: string) {
  const file = await prisma.videoFile.findUnique({
    where: { id: fileId },
    include: { movie: true },
  });
  if (!file?.movie || file.title) return;
  await prisma.videoFile.update({
    where: { id: fileId },
    data: {
      title: file.movie.title,
      year: file.movie.year,
      overview: file.movie.overview,
    },
  });
}

export async function saveMovieVersion(input: {
  movieId: string;
  fileId?: string | null;
  title: string;
  year: string;
  overview: string;
  tmdb?: string;
}): Promise<{ movieId: string }> {
  const editorial = parseEditorial({
    title: input.title,
    year: input.year,
    overview: input.overview,
  });
  const tmdb = input.tmdb?.trim() ?? "";

  if (input.fileId) {
    const file = await prisma.videoFile.findUnique({ where: { id: input.fileId } });
    if (!file || file.movieId !== input.movieId) {
      throw new Error("That version does not belong to this movie.");
    }
    await prisma.videoFile.update({
      where: { id: input.fileId },
      data: editorial,
    });
  } else {
    await prisma.movie.update({
      where: { id: input.movieId },
      data: editorial,
    });
  }

  if (!tmdb) return { movieId: input.movieId };

  if (!input.fileId) {
    await relinkMovieFromTmdb(input.movieId, tmdb);
    return { movieId: input.movieId };
  }

  return relinkMovieVersionFromTmdb(input.movieId, input.fileId, tmdb);
}

function parseEditorial(data: { title: string; year: string; overview: string }) {
  const title = data.title.trim();
  if (!title) throw new Error("Title cannot be empty.");
  const year = data.year.trim() ? Number(data.year) : null;
  if (data.year.trim() && (!Number.isInteger(year) || year! < 1880 || year! > 2100)) {
    throw new Error("Year must be a number such as 1999.");
  }
  return { title, year, overview: data.overview.trim() || null };
}

export async function relinkMovieFromTmdb(movieId: string, urlOrId: string) {
  const tmdbId = parseTmdbMovieId(urlOrId);
  if (!tmdbId) {
    throw new Error(
      "Please paste a TMDB movie URL such as https://www.themoviedb.org/movie/603-the-matrix",
    );
  }

  const existing = await prisma.movie.findUnique({ where: { tmdbId } });
  if (existing && existing.id !== movieId) {
    throw new Error("That TMDB title is already in the library. Move a version onto it instead.");
  }

  await applyTmdbDetailsToMovie(movieId, tmdbId);
}

async function relinkMovieVersionFromTmdb(
  movieId: string,
  fileId: string,
  urlOrId: string,
): Promise<{ movieId: string }> {
  const tmdbId = parseTmdbMovieId(urlOrId);
  if (!tmdbId) {
    throw new Error(
      "Please paste a TMDB movie URL such as https://www.themoviedb.org/movie/603-the-matrix",
    );
  }

  const details = await getMovieDetails(tmdbId);
  const target = await upsertMovieFromTmdb(tmdbId);

  if (target.id === movieId) {
    await applyTmdbDetailsToMovie(movieId, tmdbId);
    await prisma.videoFile.update({
      where: { id: fileId },
      data: {
        title: details.title,
        year: yearFromReleaseDate(details.release_date),
        overview: details.overview || null,
      },
    });
    return { movieId };
  }

  await prisma.videoFile.update({
    where: { id: fileId },
    data: {
      movieId: target.id,
      status: "matched",
      candidates: Prisma.DbNull,
      title: details.title,
      year: yearFromReleaseDate(details.release_date),
      overview: details.overview || null,
    },
  });

  const remaining = await prisma.videoFile.count({ where: { movieId } });
  if (remaining === 0) {
    await prisma.movie.delete({ where: { id: movieId } });
  }

  return { movieId: target.id };
}

export async function deleteMovie(movieId: string) {
  await prisma.$transaction([
    prisma.videoFile.updateMany({
      where: { movieId },
      data: { movieId: null, status: "needs_review" },
    }),
    prisma.movie.delete({ where: { id: movieId } }),
  ]);
}

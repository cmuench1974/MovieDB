import type { FolderKind, Prisma } from "@prisma/client";
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
  const title = data.title.trim();
  if (!title) throw new Error("Title cannot be empty.");
  const year = data.year.trim() ? Number(data.year) : null;
  if (data.year.trim() && (!Number.isInteger(year) || year! < 1880 || year! > 2100)) {
    throw new Error("Year must be a number such as 1999.");
  }
  await prisma.movie.update({
    where: { id: movieId },
    data: { title, year, overview: data.overview.trim() || null },
  });
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
    throw new Error("That TMDB title is already in the library.");
  }

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

  await prisma.movie.update({
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
      cast: (details.credits?.cast ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .slice(0, 8)
        .map((member) => ({
          name: member.name,
          character: member.character,
          profile_path: member.profile_path,
        })) as unknown as Prisma.InputJsonValue,
      genres: { set: genres.map((genre) => ({ id: genre.id })) },
    },
  });
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

import { prisma } from "./prisma";
import type { MatchStatus } from "@prisma/client";

/** Vergleich Movie-Anzahl vs. VideoFile-Anzahl für die Admin-Übersicht. */
export async function getLibraryFileOverview() {
  const [movieCount, fileCount, statusGroups, unmatched, movies] = await Promise.all([
    prisma.movie.count(),
    prisma.videoFile.count(),
    prisma.videoFile.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.videoFile.findMany({
      where: { movieId: null },
      orderBy: [{ status: "asc" }, { filename: "asc" }],
      select: {
        id: true,
        filename: true,
        status: true,
        parsedTitle: true,
        parsedYear: true,
        path: true,
      },
    }),
    prisma.movie.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        year: true,
        hidden: true,
        _count: { select: { videoFiles: true } },
      },
    }),
  ]);

  const byStatus = new Map<MatchStatus, number>(
    statusGroups.map((row) => [row.status, row._count._all]),
  );

  return {
    movieCount,
    fileCount,
    extraFiles: fileCount - movieCount,
    statusCounts: {
      matched: byStatus.get("matched") ?? 0,
      needs_review: byStatus.get("needs_review") ?? 0,
      pending: byStatus.get("pending") ?? 0,
      ignored: byStatus.get("ignored") ?? 0,
    },
    unmatched,
    moviesWithoutFiles: movies.filter((movie) => movie._count.videoFiles === 0),
    moviesWithMultipleFiles: movies.filter((movie) => movie._count.videoFiles > 1),
  };
}

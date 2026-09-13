import { prisma } from "./prisma";

/** Kompakte Zähler für das Homepage-customapi-Widget. */
export async function getHomepageStats() {
  const [movies, catalog, hidden, files, needsReview] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { hidden: false } }),
    prisma.movie.count({ where: { hidden: true } }),
    prisma.videoFile.count(),
    prisma.videoFile.count({ where: { status: "needs_review" } }),
  ]);

  return { movies, catalog, hidden, files, needsReview };
}

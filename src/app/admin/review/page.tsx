import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { ReviewList, type ReviewFile } from "@/components/ReviewList";
import type { TmdbCandidate } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const files = await prisma.videoFile.findMany({
    where: { status: "needs_review" },
    orderBy: { filename: "asc" },
  });

  const reviewFiles: ReviewFile[] = files.map((file) => ({
    id: file.id,
    filename: file.filename,
    parsedTitle: file.parsedTitle,
    parsedYear: file.parsedYear,
    candidates: Array.isArray(file.candidates)
      ? (file.candidates as TmdbCandidate[])
      : [],
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <AdminNav current="review" />
      <h1 className="text-2xl font-semibold">Review matches</h1>
      <p className="mt-2 mb-8 text-sm text-zinc-400">
        Pick the correct TMDB title, or paste the movie URL if none of the suggestions fit.
      </p>
      <ReviewList files={reviewFiles} />
    </main>
  );
}

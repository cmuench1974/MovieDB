import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { ScanButton } from "@/components/ScanButton";
import { AddFileForm } from "@/components/AddFileForm";
import { hasTmdbApiKey } from "@/lib/settings";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminScanPage() {
  const [movieCount, fileCount, reviewCount, lastJob, tmdbConfigured, folders] = await Promise.all([
    prisma.movie.count(),
    prisma.videoFile.count(),
    prisma.videoFile.count({ where: { status: "needs_review" } }),
    prisma.scanJob.findFirst({ orderBy: { startedAt: "desc" } }),
    hasTmdbApiKey(),
    prisma.scanFolder.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        label: true,
        kind: true,
        path: true,
        smbHost: true,
        smbShare: true,
        smbFolder: true,
      },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <AdminNav current="scan" />
      <h1 className="text-2xl font-semibold">Scan</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Scan folders re-checks every file. Scan new movies only adds files that are not in the
        library yet. Update file info re-reads codec, HDR, audio, subtitles, filename, and size.
        Update metadata refreshes TMDB details without changing posters.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Movies" value={movieCount} href="/admin/movies" />
        <Stat
          label="Video files"
          value={fileCount}
          href="/admin/files"
          highlight={movieCount !== fileCount}
        />
        <Stat
          label="Need review"
          value={reviewCount}
          href={reviewCount > 0 ? "/admin/review" : undefined}
        />
        <Stat
          label="Last scan"
          value={
            lastJob
              ? lastJob.status === "completed"
                ? lastJob.startedAt.toLocaleString()
                : lastJob.status === "running"
                  ? "In progress"
                  : lastJob.status === "cancelled"
                    ? "Stopped"
                    : lastJob.status
              : "Never"
          }
        />
      </dl>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Library scan</h2>
        <p className="mt-2 mb-4 text-sm text-zinc-400">
          Folders are managed under Settings. A TMDB API key is needed for folder scans and metadata
          updates. Update file info can run without it.
        </p>
        <ScanButton tmdbConfigured={tmdbConfigured} />
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Add one file</h2>
        <p className="mt-2 mb-4 text-sm text-zinc-400">
          If a new movie is already on the share, paste its path here. MovieDB checks that the file
          exists, stores it, reads media info, and looks up TMDB metadata.
        </p>
        <AddFileForm folders={folders} tmdbConfigured={tmdbConfigured} />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: string | number;
  href?: string;
  highlight?: boolean;
}) {
  const className = `rounded-xl border p-4 ${
    highlight ? "border-amber-400/60 bg-amber-400/5" : "border-zinc-800 bg-zinc-900"
  }`;
  const content = (
    <>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-xl font-medium text-zinc-100">{value}</dd>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-amber-400`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

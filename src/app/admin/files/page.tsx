import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/admin";
import { getLibraryFileOverview } from "@/lib/library-stats";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage() {
  await requireAdmin();
  const overview = await getLibraryFileOverview();
  const countsDiffer = overview.movieCount !== overview.fileCount;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <AdminNav current="files" />
      <h1 className="text-2xl font-semibold">Video files</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Movies and video files are not 1:1. One title can have several versions, and some files are
        still unmatched, waiting for review, or ignored.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Movies" value={overview.movieCount} href="/admin/movies" />
        <Stat label="Video files" value={overview.fileCount} highlight={countsDiffer} />
        <Stat
          label="Difference"
          value={
            overview.extraFiles === 0
              ? "None"
              : overview.extraFiles > 0
                ? `+${overview.extraFiles} files`
                : `${overview.extraFiles} files`
          }
          highlight={countsDiffer}
        />
        <Stat
          label="Unmatched files"
          value={overview.unmatched.length}
          href={overview.statusCounts.needs_review > 0 ? "/admin/review" : undefined}
        />
      </dl>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Files by status</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <li className="flex justify-between gap-4 text-zinc-300">
            <span>Matched to a movie</span>
            <span className="text-zinc-100">{overview.statusCounts.matched}</span>
          </li>
          <li className="flex justify-between gap-4 text-zinc-300">
            <span>Needs review</span>
            <span className="text-zinc-100">{overview.statusCounts.needs_review}</span>
          </li>
          <li className="flex justify-between gap-4 text-zinc-300">
            <span>Pending</span>
            <span className="text-zinc-100">{overview.statusCounts.pending}</span>
          </li>
          <li className="flex justify-between gap-4 text-zinc-300">
            <span>Ignored</span>
            <span className="text-zinc-100">{overview.statusCounts.ignored}</span>
          </li>
        </ul>
      </section>

      {overview.moviesWithMultipleFiles.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Titles with more than one file</h2>
          <p className="mt-1 mb-3 text-sm text-zinc-500">
            Extra files here are extra versions (HD/UHD, cuts), not duplicate movies.
          </p>
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {overview.moviesWithMultipleFiles.map((movie) => (
              <li key={movie.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <Link href={`/admin/movies/${movie.id}`} className="text-zinc-100 hover:text-amber-300">
                  {movie.title}
                  {movie.year ? ` (${movie.year})` : ""}
                  {movie.hidden ? (
                    <span className="ml-2 text-xs text-amber-400">Hidden</span>
                  ) : null}
                </Link>
                <span className="text-sm text-zinc-500">{movie._count.videoFiles} files</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {overview.moviesWithoutFiles.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Movies without a video file</h2>
          <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {overview.moviesWithoutFiles.map((movie) => (
              <li key={movie.id} className="px-4 py-3">
                <Link href={`/admin/movies/${movie.id}`} className="text-zinc-100 hover:text-amber-300">
                  {movie.title}
                  {movie.year ? ` (${movie.year})` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {overview.unmatched.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Files not attached to a movie</h2>
          <p className="mt-1 mb-3 text-sm text-zinc-500">
            These count toward Video files but not Movies. Review or ignore them from Review
            matches.
          </p>
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {overview.unmatched.map((file) => (
              <li key={file.id} className="px-4 py-3">
                <p className="text-sm text-zinc-100">{file.filename}</p>
                <p className="text-xs text-zinc-500">
                  {[
                    file.status.replace("_", " "),
                    file.parsedTitle,
                    file.parsedYear,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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

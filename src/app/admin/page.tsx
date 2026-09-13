import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { ScanButton } from "@/components/ScanButton";
import { FolderForm } from "@/components/FolderForm";
import { FolderList } from "@/components/FolderList";
import { TmdbKeyForm } from "@/components/TmdbKeyForm";
import { DatabaseTools } from "@/components/DatabaseTools";
import { SmtpSettingsForm } from "@/components/SmtpSettingsForm";
import { hasTmdbApiKey } from "@/lib/settings";
import { getPublicSmtpSettings } from "@/lib/mail";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [movieCount, fileCount, reviewCount, lastJob, folders, tmdbConfigured, smtp] =
    await Promise.all([
    prisma.movie.count(),
    prisma.videoFile.count(),
    prisma.videoFile.count({ where: { status: "needs_review" } }),
    prisma.scanJob.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.scanFolder.findMany({ orderBy: { createdAt: "asc" } }),
    hasTmdbApiKey(),
    getPublicSmtpSettings(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <AdminNav current="scan" />
      <h1 className="text-2xl font-semibold">Library maintenance</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Add folders or SMB shares, then scan. Ambiguous titles go to Review matches.
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

      <section className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Folders</h2>
        <p className="mt-2 mb-4 text-sm text-zinc-400">
          Local/NFS paths must be visible inside the container. On Windows, SMB uses the shares
          already mapped on this PC (run <code>scripts/ensure-smb-bridge.ps1</code> once). You can
          enter the NAS name, share, and an optional subfolder — username/password can stay empty.
        </p>
        <FolderList folders={folders} />
        <div className="mt-6 border-t border-zinc-800 pt-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Add folder
          </h3>
          <FolderForm />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">TMDB API key</h2>
        <p className="mt-2 mb-4 text-sm text-zinc-400">
          MovieDB looks up titles on The Movie Database. You can enter the key here instead of
          editing <code>.env</code>.
        </p>
        <TmdbKeyForm configured={tmdbConfigured} />
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Email</h2>
        <p className="mt-2 mb-4 text-sm text-zinc-400">
          SMTP is used for welcome emails (optional site guide), account notices when you create a
          user, and new-movie notifications to users who opted in.
        </p>
        <SmtpSettingsForm settings={smtp} />
      </section>

      <DatabaseTools />

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">Scan</h2>
        <p className="mt-2 mb-4 text-sm text-zinc-400">
          Scan folders re-checks every file (including media info). Scan new movies only adds files
          that are not in the library yet. Update metadata refreshes TMDB details for titles you
          already have.
        </p>
        <ScanButton tmdbConfigured={tmdbConfigured} />
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

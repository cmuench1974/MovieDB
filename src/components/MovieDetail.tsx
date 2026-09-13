"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PosterImage } from "./PosterImage";
import { MovieAdminButtons } from "./MovieAdminButtons";
import { AddToListForm } from "./AddToListForm";
import type { MovieVersionView } from "@/lib/movie-view";

type MovieDetailProps = {
  movieId: string;
  hidden: boolean;
  posterPath: string | null;
  voteLabel: string | null;
  genres: { id: string; name: string }[];
  versions: MovieVersionView[];
  initialVersionId: string | null;
  isAdmin: boolean;
  isLoggedIn: boolean;
  lists: { id: string; name: string }[];
  catalogTitle: string;
  catalogYear: number | null;
  catalogOverview: string | null;
  catalogRuntime: string | null;
  backHref: string;
  returnPath: string;
};

export function MovieDetail({
  movieId,
  hidden,
  posterPath,
  voteLabel,
  genres,
  versions,
  initialVersionId,
  isAdmin,
  isLoggedIn,
  lists,
  catalogTitle,
  catalogYear,
  catalogOverview,
  catalogRuntime,
  backHref,
  returnPath,
}: MovieDetailProps) {
  const router = useRouter();
  const fallback = versions[0] ?? null;
  const [versionId, setVersionId] = useState(initialVersionId ?? fallback?.id ?? null);
  const version = versions.find((item) => item.id === versionId) ?? fallback;
  const title = version?.title ?? catalogTitle;

  function selectVersion(id: string) {
    setVersionId(id);
    const params = new URLSearchParams();
    params.set("v", id);
    if (returnPath !== "/") params.set("from", returnPath);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[16rem_1fr]">
      <div className="relative mx-auto aspect-[2/3] w-56 overflow-hidden rounded-xl bg-zinc-800 shadow-xl md:w-full">
        <PosterImage path={posterPath} alt={title} size="w500" />
      </div>
      <div className="flex flex-col justify-center">
        <Link
          href={backHref}
          className="inline-flex w-fit rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-400"
        >
          Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {hidden ? (
          <p className="mt-2 text-sm text-amber-400">Hidden from the public catalog.</p>
        ) : null}

        {versions.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {versions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectVersion(item.id)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  item.id === version?.id
                    ? "border-amber-400 bg-amber-400/15 text-amber-200"
                    : "border-zinc-700 text-zinc-300 hover:border-amber-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {version ? (
          <p className="mt-3 text-zinc-400">
            {[
              version.year,
              version.runtimeLabel,
              version.resolutionLabel,
              version.hdrFormat,
              voteLabel ? `★ ${voteLabel}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : (
          <p className="mt-3 text-zinc-400">
            {[catalogYear, catalogRuntime, voteLabel ? `★ ${voteLabel}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {genres.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {genres.map((genre) => (
              <li
                key={genre.id}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300"
              >
                {genre.name}
              </li>
            ))}
          </ul>
        ) : null}

        {version?.overview || (!version && catalogOverview) ? (
          <p className="mt-6 max-w-2xl text-sm leading-7 text-zinc-300">
            {version?.overview ?? catalogOverview}
          </p>
        ) : null}

        {version ? <VersionTech version={version} /> : null}

        {isLoggedIn ? <AddToListForm movieId={movieId} lists={lists} /> : null}

        {isAdmin ? (
          <div className="mt-6">
            <MovieAdminButtons
              movieId={movieId}
              hidden={hidden}
              title={title}
              versionId={version?.id}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function VersionTech({ version }: { version: MovieVersionView }) {
  const rows: { label: string; value: string }[] = [];
  if (version.pixelLabel || version.videoCodec) {
    rows.push({
      label: "Video",
      value: [version.pixelLabel, version.videoCodec].filter(Boolean).join(" · "),
    });
  }
  if (version.audioLabels.length) {
    rows.push({ label: "Audio", value: version.audioLabels.join(", ") });
  }
  if (version.subtitleLabels.length) {
    rows.push({ label: "Subtitles", value: version.subtitleLabels.join(", ") });
  }
  rows.push({ label: "File", value: `${version.filename} · ${version.sizeLabel}` });

  return (
    <dl className="mt-6 max-w-2xl space-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1 sm:grid-cols-[7rem_1fr]">
          <dt className="text-zinc-500">{row.label}</dt>
          <dd className="text-zinc-300">{row.value}</dd>
        </div>
      ))}
      {!version.probed ? (
        <p className="text-xs text-zinc-500">
          Technical details appear after the next scan (ffprobe).
        </p>
      ) : null}
      {version.probeError ? (
        <p className="text-xs text-amber-400">{version.probeError}</p>
      ) : null}
    </dl>
  );
}

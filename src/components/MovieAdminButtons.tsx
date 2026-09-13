"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMovieAction, hideMovieAction } from "@/app/admin/actions";

export function MovieAdminButtons({
  movieId,
  hidden,
  title,
  versionId,
}: {
  movieId: string;
  hidden: boolean;
  title: string;
  versionId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await hideMovieAction(movieId, !hidden);
          })
        }
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-400"
      >
        {hidden ? "Unhide" : "Hide"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          router.push(
            versionId ? `/admin/movies/${movieId}?v=${versionId}` : `/admin/movies/${movieId}`,
          )
        }
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-400"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Remove “${title}” from the library? Files on disk are kept; they will show up again under Review matches.`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            await deleteMovieAction(movieId);
            router.push("/admin/movies");
          });
        }}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-red-300 hover:border-red-400"
      >
        Remove
      </button>
    </div>
  );
}

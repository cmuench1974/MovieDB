"use client";

import { useEffect, useState } from "react";

type TrailerButtonProps = {
  videoKey: string;
  title: string;
};

export function TrailerButton({ videoKey, title }: TrailerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-amber-400"
      >
        Trailer
      </button>
      {open ? (
        <TrailerModal videoKey={videoKey} title={title} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function TrailerModal({
  videoKey,
  title,
  onClose,
}: TrailerButtonProps & { onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoKey)}?autoplay=1&rel=0`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close trailer"
      />
      <div className="relative z-10 w-full max-w-5xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-medium text-zinc-100">{title} · Trailer</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-xl">
          <iframe
            src={src}
            title={`${title} trailer`}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { tmdbImageUrl } from "@/lib/tmdb-image";

export function PosterImage({
  path,
  alt,
  size = "w342",
  className = "",
}: {
  path?: string | null;
  alt: string;
  size?: "w185" | "w342" | "w500" | "w780" | "original";
  className?: string;
}) {
  const src = tmdbImageUrl(path, size);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 text-center text-xs text-zinc-500 ${className}`}
      >
        No poster
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
      className={`object-cover ${className}`}
    />
  );
}

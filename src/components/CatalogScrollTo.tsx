"use client";

import { useEffect } from "react";

/** Scrollt die Filmkarte mit der gegebenen ID in die Bildmitte. */
export function CatalogScrollTo({ movieId }: { movieId: string }) {
  useEffect(() => {
    if (!movieId) return;
    const el = document.getElementById(`movie-${movieId}`);
    if (!el) return;

    const scroll = () => el.scrollIntoView({ behavior: "smooth", block: "center" });
    scroll();
    const timer = window.setTimeout(scroll, 250);
    return () => window.clearTimeout(timer);
  }, [movieId]);

  return null;
}

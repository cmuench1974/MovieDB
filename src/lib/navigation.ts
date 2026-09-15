/** Nur Katalog, Listen-Detail und Library — gegen Open Redirects. */
function isAllowedReturnPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/admin/movies" ||
    /^\/lists\/[a-zA-Z0-9_-]+$/.test(pathname) ||
    /^\/people\/[a-zA-Z0-9_-]+$/.test(pathname) ||
    /^\/movies\/[a-zA-Z0-9_-]+$/.test(pathname)
  );
}

/** Nur interne relative Pfade, gegen Open Redirects. */
export function safeReturnPath(value: string | undefined | null, fallback = "/"): string {
  if (!value) return fallback;
  if (value.length > 512) return fallback;

  let url: URL;
  try {
    url = new URL(value, "http://moviedb.invalid");
  } catch {
    return fallback;
  }

  if (url.origin !== "http://moviedb.invalid") return fallback;
  if (url.username || url.password) return fallback;
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback;
  if (!isAllowedReturnPath(url.pathname)) return fallback;

  return `${url.pathname}${url.search}`;
}

/** Hängt oder ersetzt den Fokus-Parameter für die Rückkehr zur Kartenansicht. */
export function withMovieFocus(path: string, movieId: string): string {
  const url = new URL(safeReturnPath(path), "http://moviedb.invalid");
  url.searchParams.set("focus", movieId);
  return `${url.pathname}${url.search}`;
}

/** Link zur Detailseite, merkt sich die Herkunft für den Back-Button. */
export function movieDetailHref(movieId: string, from?: string | null): string {
  const params = new URLSearchParams();
  const returnPath = from ? safeReturnPath(from) : "/";
  if (returnPath !== "/") params.set("from", returnPath);
  const qs = params.toString();
  return qs ? `/movies/${movieId}?${qs}` : `/movies/${movieId}`;
}

/** Baut einen Pfad aus optionalen Query-Werten, leere Keys fallen weg. */
export function pathWithQuery(
  pathname: string,
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Primär Titel A–Z, bei gleichem Titel nach Produktionsjahr (älter zuerst). */
export const movieTitleYearOrder = [
  { title: "asc" as const },
  { year: { sort: "asc" as const, nulls: "last" as const } },
];

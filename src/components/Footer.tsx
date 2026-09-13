export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
      <p>
        This product uses the TMDB API but is not endorsed or certified by{" "}
        <a
          className="text-zinc-300 underline-offset-2 hover:text-amber-400 hover:underline"
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noreferrer"
        >
          TMDB
        </a>
        .
      </p>
    </footer>
  );
}

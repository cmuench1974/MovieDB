import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { TmdbMovieDetails } from "./tmdb";

const MAX_CAST_STORED = 15;

/** Kommagetrennte Regie aus TMDB-Crew, ohne extra API-Call. */
export function directorNameFromDetails(details: TmdbMovieDetails): string | null {
  const names = tmdbDirectors(details).map((item) => item.name);
  return names.length ? names.join(", ") : null;
}

export function tmdbDirectors(details: TmdbMovieDetails) {
  return (details.credits?.crew ?? []).filter(
    (member) => member.job === "Director" && member.id && member.name,
  );
}

export function tmdbBilledCast(details: TmdbMovieDetails) {
  return (details.credits?.cast ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .filter((member) => member.id && member.name)
    .slice(0, MAX_CAST_STORED);
}

/**
 * Personen und Credits aus dem bereits geladenen Movie-credits-Payload.
 * Kein zusätzlicher TMDB-Request.
 */
export async function syncMovieCredits(movieId: string, details: TmdbMovieDetails) {
  const directors = tmdbDirectors(details);
  const cast = tmdbBilledCast(details);
  const byTmdbId = new Map<number, { name: string; profilePath: string | null }>();

  for (const member of [...directors, ...cast]) {
    if (!byTmdbId.has(member.id)) {
      byTmdbId.set(member.id, {
        name: member.name,
        profilePath: member.profile_path ?? null,
      });
    }
  }

  const personIds = new Map<number, string>();
  for (const [tmdbId, person] of byTmdbId) {
    const row = await prisma.person.upsert({
      where: { tmdbId },
      create: { tmdbId, name: person.name, profilePath: person.profilePath },
      update: { name: person.name, profilePath: person.profilePath },
      select: { id: true },
    });
    personIds.set(tmdbId, row.id);
  }

  const credits: Prisma.MovieCreditCreateManyInput[] = [];
  const usedDirectors = new Set<number>();
  directors.forEach((member, index) => {
    if (usedDirectors.has(member.id)) return;
    usedDirectors.add(member.id);
    const personId = personIds.get(member.id);
    if (!personId) return;
    credits.push({
      movieId,
      personId,
      role: "director",
      billingOrder: index,
    });
  });
  const usedCast = new Set<number>();
  cast.forEach((member) => {
    if (usedCast.has(member.id)) return;
    usedCast.add(member.id);
    const personId = personIds.get(member.id);
    if (!personId) return;
    credits.push({
      movieId,
      personId,
      role: "actor",
      character: member.character || null,
      billingOrder: member.order,
    });
  });

  await prisma.$transaction([
    prisma.movieCredit.deleteMany({ where: { movieId } }),
    ...(credits.length ? [prisma.movieCredit.createMany({ data: credits })] : []),
  ]);
}

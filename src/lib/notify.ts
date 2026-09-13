import { prisma } from "./prisma";
import { getSmtpSettings, sendMail, siteUrlFromSettings } from "./mail";

export type NewMovieNotice = {
  id: string;
  title: string;
  year: number | null;
};

export async function notifyUsersAboutNewMovies(movies: NewMovieNotice[]): Promise<void> {
  if (movies.length === 0) return;

  const smtp = await getSmtpSettings();
  if (!smtp?.host || !smtp.from) {
    console.warn("Skipping new-movie emails: SMTP is not configured.");
    return;
  }

  const recipients = await prisma.user.findMany({
    where: { notifyNewMovies: true },
    select: { email: true, username: true },
  });
  if (recipients.length === 0) return;

  const site = await siteUrlFromSettings();
  const lines = movies.slice(0, 40).map((movie) => {
    const year = movie.year ? ` (${movie.year})` : "";
    return `- ${movie.title}${year}: ${site}/movies/${movie.id}`;
  });
  const extra =
    movies.length > 40 ? `\n…and ${movies.length - 40} more in the catalog.` : "";
  const subject =
    movies.length === 1
      ? `New on MovieDB: ${movies[0].title}`
      : `${movies.length} new movies on MovieDB`;
  const text = [
    "New titles were added to MovieDB:",
    "",
    ...lines,
    extra,
    "",
    `Catalog: ${site}/`,
  ].join("\n");

  for (const recipient of recipients) {
    try {
      await sendMail({ to: recipient.email, subject, text });
    } catch (error) {
      console.error(`Could not notify ${recipient.email}:`, error);
    }
  }
}

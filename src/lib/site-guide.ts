import type { UserRole } from "@prisma/client";

/**
 * Nutzer- und Admin-Kurzanleitung für Welcome-Mails.
 * Bei neuen sichtbaren Funktionen diese Datei mit aktualisieren
 * (siehe .cursor/rules/site-guide.mdc).
 */

type GuideSection = {
  title: string;
  items: string[];
};

function userSections(site: string): GuideSection[] {
  return [
    {
      title: "Sign in",
      items: [
        `Open ${site}/login and sign in with your username or email, plus the password your administrator set.`,
        "The catalog is public. Signing in also shows hidden titles and unlocks lists.",
      ],
    },
    {
      title: "Catalog",
      items: [
        `Browse posters at ${site}. Titles are A–Z; identical titles are ordered by production year (older first).`,
        "Search from the header, or filter by genre and year.",
        "Open a title for plot, cast, runtime, and technical details (resolution, codecs, audio, subtitles).",
        "Some titles have more than one file (for example HD and UHD). Switch versions on the detail page.",
        "Back returns to the previous catalog, search, or list and highlights the title you just viewed.",
      ],
    },
    {
      title: "Lists",
      items: [
        `Open ${site}/lists to create a named list, add an optional comment, and share it with other accounts.`,
        "On a movie page, use Add to list. List owners can later remove titles or change who can see the list.",
        "Lists shared with you appear under Shared with you.",
      ],
    },
    {
      title: "Your account",
      items: [
        `Open ${site}/account (or Account in the header) to change your email, password, and new-movie notification emails.`,
        "You can delete your own account there. The last administrator cannot be deleted. Your lists are removed; the catalog stays.",
      ],
    },
    {
      title: "Notifications",
      items: [
        "If new-movie emails are enabled on your account, you receive a message when newly scanned movies are added. You can turn this on or off under Account.",
      ],
    },
  ];
}

function adminSections(site: string): GuideSection[] {
  return [
    {
      title: "Admin area",
      items: [
        "Administrators see Admin in the header. Regular users cannot open /admin.",
        `Start at ${site}/admin for folders, scans, TMDB, email, backup, and user accounts.`,
        "A Homepage dashboard can show how many titles, files, and review-queue items are in the library.",
      ],
    },
    {
      title: "Folders and scanning",
      items: [
        "Add a local/NFS path (visible inside the app container) or an SMB share under Settings.",
        "Scan folders re-checks every file, including technical media info.",
        "Scan new movies only imports files that are not in the library yet.",
        "Update metadata refreshes TMDB title, overview, cast, and genres. Chosen posters and backdrops stay as they are.",
        "Ambiguous filename matches go to Review matches, where you pick the right TMDB title or ignore the file.",
      ],
    },
    {
      title: "Library",
      items: [
        `Open ${site}/admin/movies to hide a title from the public catalog, edit it, or remove it from the database. Files on disk are never deleted.`,
        "On a movie’s edit page you can change title/year/overview, rematch TMDB, pick poster and backdrop artwork, and refresh metadata for that title only.",
        "Hide, Edit, and Remove are also available on the public movie page for administrators.",
        "Signed-in users still see hidden titles, marked with a Hidden badge.",
        `If the Movies and Video files numbers differ, open ${site}/admin/files for extra versions, unmatched files, and movies without a file.`,
      ],
    },
    {
      title: "Users and email",
      items: [
        `Create accounts at ${site}/admin/users (username, email, password, user or administrator).`,
        "A welcome email is sent when SMTP is configured. You can attach this site guide, matching the new account’s group.",
        "Per-user option: email when new movies are added.",
        "SMTP lives under Settings. Port 587 uses STARTTLS; port 465 uses implicit TLS. Send a test email after changing settings.",
      ],
    },
    {
      title: "TMDB and backup",
      items: [
        "Store the TMDB API key on the admin page (encrypted). Scans and metadata refresh need it.",
        "Download a SQL backup anytime, or restore a previous .sql backup (this replaces the whole database, including users). Type RESTORE to confirm.",
        "Clear database wipes movies and scan history but keeps the admin login and TMDB key. Disk files are never deleted.",
        "If Movies and Video files counts differ, click Video files on the admin home to see extra versions, unmatched files, and titles without a file.",
      ],
    },
  ];
}

function renderSections(sections: GuideSection[]): string {
  return sections
    .map((section) => [`${section.title}`, ...section.items.map((item) => `- ${item}`)].join("\n"))
    .join("\n\n");
}

/** Vollständiger Guide-Text für die jeweilige Rolle. */
export function formatSiteGuide(role: UserRole, siteUrl: string): string {
  const site = siteUrl.replace(/\/$/, "") || "http://localhost:3000";
  const sections =
    role === "admin" ? [...userSections(site), ...adminSections(site)] : userSections(site);
  const heading =
    role === "admin"
      ? "How MovieDB works (administrator)"
      : "How MovieDB works";
  return [`${heading}`, "", renderSections(sections)].join("\n");
}

export function welcomeEmailBody(input: {
  username: string;
  email: string;
  role: UserRole;
  siteUrl: string;
  includeGuide: boolean;
}): string {
  const site = input.siteUrl.replace(/\/$/, "") || "http://localhost:3000";
  const lines = [
    `Hello ${input.username},`,
    "",
    "An account was created for you on MovieDB.",
    `Username: ${input.username}`,
    `Email: ${input.email}`,
    `Role: ${input.role === "admin" ? "administrator" : "user"}`,
    "",
    `Sign in at ${site}/login with the password your administrator set.`,
    "You can use either your username or your email address.",
    "The catalog can still be viewed without signing in.",
  ];

  if (input.includeGuide) {
    lines.push("", formatSiteGuide(input.role, site));
  }

  return lines.join("\n");
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "./prisma";

const execFileAsync = promisify(execFile);

export async function dumpDatabaseSql(): Promise<Buffer> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  try {
    const { stdout } = await execFileAsync(
      "pg_dump",
      ["--dbname", url, "--no-owner", "--no-acl"],
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 60_000,
      },
    );
    return Buffer.from(stdout, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT") || message.includes("not found")) {
      throw new Error(
        "pg_dump is missing in the container image. Rebuild with docker compose up --build.",
      );
    }
    throw new Error(message.replace(/\s+/g, " ").trim() || "Database backup failed.");
  }
}

export async function clearLibrary() {
  // Nutzer, SMTP-Einstellungen und TMDB-Schlüssel bleiben erhalten.
  // Listeneinträge fallen mit den Filmen weg (Cascade), die Listen selbst bleiben.
  await prisma.$transaction([
    prisma.videoFile.deleteMany(),
    prisma.scanJob.deleteMany(),
    prisma.scanFolder.deleteMany(),
    prisma.movie.deleteMany(),
    prisma.genre.deleteMany(),
  ]);
}

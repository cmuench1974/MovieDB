import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { prisma } from "./prisma";

const execFileAsync = promisify(execFile);
const MAX_RESTORE_BYTES = 64 * 1024 * 1024;

export async function dumpDatabaseSql(): Promise<Buffer> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  try {
    const { stdout } = await execFileAsync(
      "pg_dump",
      ["--dbname", url, "--no-owner", "--no-acl", "--clean", "--if-exists"],
      {
        encoding: "utf8",
        maxBuffer: MAX_RESTORE_BYTES,
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

/** Ersetzt die Datenbank durch einen zuvor heruntergeladenen pg_dump (plain SQL). */
export async function restoreDatabaseSql(sql: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (Buffer.byteLength(sql, "utf8") > MAX_RESTORE_BYTES) {
    throw new Error("Backup file is larger than 64 MB.");
  }
  if (!looksLikeSqlDump(sql)) {
    throw new Error("That file does not look like a MovieDB SQL backup from Download backup.");
  }

  const dir = await mkdtemp(join(tmpdir(), "moviedb-restore-"));
  const file = join(dir, "backup.sql");
  try {
    await writeFile(file, sql, { encoding: "utf8", mode: 0o600 });
    await prisma.$disconnect();
    try {
      await execFileAsync(
        "psql",
        [
          "--dbname",
          url,
          "--set",
          "ON_ERROR_STOP=1",
          "--command",
          "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
        ],
        { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
      );
      await execFileAsync("psql", ["--dbname", url, "--set", "ON_ERROR_STOP=1", "--file", file], {
        timeout: 120_000,
        maxBuffer: MAX_RESTORE_BYTES,
      });
    } finally {
      await prisma.$connect();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT") || message.includes("not found")) {
      throw new Error(
        "psql is missing in the container image. Rebuild with docker compose up --build.",
      );
    }
    throw new Error(message.replace(/\s+/g, " ").trim() || "Database restore failed.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function looksLikeSqlDump(sql: string): boolean {
  const head = sql.slice(0, 8000);
  return (
    /PostgreSQL database dump/i.test(head) ||
    /pg_dump/i.test(head) ||
    /CREATE TABLE/i.test(head)
  );
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

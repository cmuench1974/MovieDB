import { prisma } from "./prisma";
import { decryptSecret, encryptSecret } from "./secrets";

const TMDB_KEY = "tmdbApiKey";

let cachedTmdbKey: string | null | undefined;

export function clearSettingsCache() {
  cachedTmdbKey = undefined;
}

function envTmdbApiKey(): string | null {
  return process.env.TMDB_API_KEY?.trim() || null;
}

export async function getTmdbApiKey(): Promise<string | null> {
  if (cachedTmdbKey !== undefined) return cachedTmdbKey;

  const stored = await prisma.appSetting.findUnique({ where: { key: TMDB_KEY } });
  if (stored?.value) {
    try {
      cachedTmdbKey = decryptSecret(stored.value).trim();
      return cachedTmdbKey;
    } catch {
      // AUTH_SECRET passt nicht mehr zum gespeicherten Key — .env nutzen.
    }
  }

  cachedTmdbKey = envTmdbApiKey();
  return cachedTmdbKey;
}

/** Wenn der gespeicherte Key 401 liefert, denselben Request mit der .env versuchen. */
export function fallbackTmdbApiKey(failedKey: string): string | null {
  const fromEnv = envTmdbApiKey();
  if (!fromEnv || fromEnv === failedKey) return null;
  cachedTmdbKey = fromEnv;
  return fromEnv;
}

export async function hasTmdbApiKey(): Promise<boolean> {
  return Boolean(await getTmdbApiKey());
}

export async function saveTmdbApiKey(plain: string): Promise<void> {
  const key = plain.trim();
  if (!key) {
    throw new Error("Please paste your TMDB API key.");
  }
  await assertTmdbKeyWorks(key);
  const encrypted = encryptSecret(key);
  await prisma.appSetting.upsert({
    where: { key: TMDB_KEY },
    create: { key: TMDB_KEY, value: encrypted },
    update: { value: encrypted },
  });
  cachedTmdbKey = key;
}

export async function clearTmdbApiKey(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: TMDB_KEY } });
  cachedTmdbKey = undefined;
}

async function assertTmdbKeyWorks(key: string): Promise<void> {
  const url = new URL("https://api.themoviedb.org/3/configuration");
  const headers: Record<string, string> = {};
  if (key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${key}`;
  } else {
    url.searchParams.set("api_key", key);
  }
  const response = await fetch(url, { cache: "no-store", headers });
  if (response.status === 401 || response.status === 403) {
    throw new Error("That TMDB API key was rejected. Check it at themoviedb.org/settings/api.");
  }
  if (!response.ok) {
    throw new Error(`Could not check the TMDB key (${response.status}). Try again in a moment.`);
  }
}

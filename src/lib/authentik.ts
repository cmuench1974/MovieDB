import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { decryptSecret, encryptSecret } from "./secrets";
import { siteUrlFromSettings } from "./mail";

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;
const AUTHENTIK_KEY = "authentikSettings";
const DEFAULT_SCOPES = "openid email profile";

export type AuthentikProfileInput = {
  sub: string;
  email?: string | null;
  name?: string | null;
  preferred_username?: string | null;
  nickname?: string | null;
  groups?: unknown;
};

export type AuthentikSettings = {
  clientId: string;
  clientSecret: string;
  issuer: string;
  adminGroup: string;
  allowSignup: boolean;
  scopes: string;
};

export type PublicAuthentikSettings = {
  clientId: string;
  issuer: string;
  adminGroup: string;
  allowSignup: boolean;
  scopes: string;
  configured: boolean;
  hasSecret: boolean;
  fromEnv: boolean;
  redirectUri: string;
};

type StoredAuthentik = Partial<AuthentikSettings>;

let cachedSettings: AuthentikSettings | null | undefined;

export function clearAuthentikCache() {
  cachedSettings = undefined;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const raw = value.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return fallback;
}

function envSettings(): StoredAuthentik {
  return {
    clientId: process.env.AUTH_AUTHENTIK_ID?.trim() || "",
    clientSecret: process.env.AUTH_AUTHENTIK_SECRET?.trim() || "",
    issuer: (process.env.AUTH_AUTHENTIK_ISSUER ?? "").trim().replace(/\/+$/, ""),
    adminGroup: process.env.AUTHENTIK_ADMIN_GROUP?.trim() || "",
    allowSignup: parseBool(process.env.AUTHENTIK_ALLOW_SIGNUP, true),
    scopes: (process.env.AUTHENTIK_SCOPES ?? "").trim(),
  };
}

function isComplete(settings: AuthentikSettings): boolean {
  return Boolean(settings.clientId && settings.clientSecret && settings.issuer);
}

async function storedSettings(): Promise<StoredAuthentik | null> {
  const stored = await prisma.appSetting.findUnique({ where: { key: AUTHENTIK_KEY } });
  if (!stored?.value) return null;
  try {
    return JSON.parse(decryptSecret(stored.value)) as StoredAuthentik;
  } catch {
    return null;
  }
}

function mergeSettings(fromDb: StoredAuthentik | null, fromEnv: StoredAuthentik): AuthentikSettings {
  const scopes =
    (fromDb?.scopes || fromEnv.scopes || DEFAULT_SCOPES).trim() || DEFAULT_SCOPES;
  return {
    clientId: (fromDb?.clientId || fromEnv.clientId || "").trim(),
    clientSecret: (fromDb?.clientSecret || fromEnv.clientSecret || "").trim(),
    issuer: (fromDb?.issuer || fromEnv.issuer || "").trim().replace(/\/+$/, ""),
    adminGroup: (fromDb?.adminGroup ?? fromEnv.adminGroup ?? "").trim(),
    allowSignup: fromDb?.allowSignup ?? fromEnv.allowSignup ?? true,
    scopes,
  };
}

/** Vollständige Runtime-Config oder null, wenn SSO nicht nutzbar ist. */
export async function getAuthentikSettings(): Promise<AuthentikSettings | null> {
  if (cachedSettings !== undefined) return cachedSettings;
  const merged = mergeSettings(await storedSettings(), envSettings());
  cachedSettings = isComplete(merged) ? merged : null;
  return cachedSettings;
}

export async function isAuthentikConfigured(): Promise<boolean> {
  return Boolean(await getAuthentikSettings());
}

export async function getPublicAuthentikSettings(): Promise<PublicAuthentikSettings> {
  const fromDb = await storedSettings();
  const fromEnv = envSettings();
  const merged = mergeSettings(fromDb, fromEnv);
  const site = (await siteUrlFromSettings()).replace(/\/$/, "");
  return {
    clientId: merged.clientId,
    issuer: merged.issuer,
    adminGroup: merged.adminGroup,
    allowSignup: merged.allowSignup,
    scopes: merged.scopes === DEFAULT_SCOPES ? "" : merged.scopes,
    configured: isComplete(merged),
    hasSecret: Boolean(merged.clientSecret),
    fromEnv: Boolean(!fromDb && fromEnv.clientId && fromEnv.clientSecret && fromEnv.issuer),
    redirectUri: `${site}/api/auth/callback/authentik`,
  };
}

function normalizeIssuer(value: string): string {
  const issuer = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    throw new Error(
      "Issuer must be a URL, e.g. https://auth.example.com/application/o/moviedb",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Issuer must start with https:// or http://");
  }
  return issuer;
}

async function assertAuthentikIssuer(issuer: string): Promise<void> {
  const discovery = `${issuer}/.well-known/openid-configuration`;
  let response: Response;
  try {
    response = await fetch(discovery, { cache: "no-store" });
  } catch {
    throw new Error(
      "Could not reach Authentik at that issuer URL. Check the slug and that MovieDB can reach Authentik.",
    );
  }
  if (!response.ok) {
    throw new Error(
      `Authentik did not return OpenID configuration (${response.status}). Check the issuer URL.`,
    );
  }
}

export async function saveAuthentikSettings(input: {
  clientId: string;
  clientSecret: string;
  issuer: string;
  adminGroup: string;
  allowSignup: boolean;
  scopes: string;
}): Promise<void> {
  const clientId = input.clientId.trim();
  const issuer = normalizeIssuer(input.issuer);
  if (!clientId) throw new Error("Please enter the Authentik client ID.");

  const existing = mergeSettings(await storedSettings(), envSettings());
  const clientSecret = input.clientSecret.trim() || existing.clientSecret;
  if (!clientSecret) {
    throw new Error("Please enter the Authentik client secret.");
  }

  await assertAuthentikIssuer(issuer);

  const settings: AuthentikSettings = {
    clientId,
    clientSecret,
    issuer,
    adminGroup: input.adminGroup.trim(),
    allowSignup: input.allowSignup,
    scopes: input.scopes.trim() || DEFAULT_SCOPES,
  };

  await prisma.appSetting.upsert({
    where: { key: AUTHENTIK_KEY },
    create: { key: AUTHENTIK_KEY, value: encryptSecret(JSON.stringify(settings)) },
    update: { value: encryptSecret(JSON.stringify(settings)) },
  });
  cachedSettings = settings;
}

export async function clearAuthentikSettings(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: AUTHENTIK_KEY } });
  cachedSettings = undefined;
}

export function groupsFromProfile(groups: unknown): string[] {
  if (Array.isArray(groups)) {
    return groups.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof groups === "string") {
    return groups
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function adminGroupNames(adminGroup: string): string[] {
  return adminGroup
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function roleFromGroups(groups: string[], adminGroup: string, current?: UserRole): UserRole {
  const names = adminGroupNames(adminGroup);
  if (names.length === 0) {
    return current ?? "user";
  }
  const set = new Set(groups.map((group) => group.toLowerCase()));
  return names.some((name) => set.has(name.toLowerCase())) ? "admin" : "user";
}

function sanitizeUsername(value: string): string {
  let username = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (username.length < 3) username = `${username || "user"}_ak`;
  return username.slice(0, 32);
}

function usernameFromProfile(profile: AuthentikProfileInput, email: string): string {
  const preferred = profile.preferred_username || profile.nickname || profile.name || email.split("@")[0];
  return sanitizeUsername(preferred || "user");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Legt bei der ersten Anmeldung ein Konto an oder verknüpft ein bestehendes
 * (zuerst über `sub`, sonst über die E-Mail).
 */
export async function upsertAuthentikUser(profile: AuthentikProfileInput) {
  const settings = await getAuthentikSettings();
  if (!settings) {
    throw new Error("Authentik is not configured.");
  }

  const sub = profile.sub.trim();
  const emailRaw = profile.email?.trim() ?? "";
  if (!sub) {
    throw new Error("Authentik did not provide a user id.");
  }
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw new Error("Authentik did not provide an email address.");
  }
  const email = normalizeEmail(emailRaw);
  const groups = groupsFromProfile(profile.groups);

  const bySub = await prisma.user.findUnique({ where: { authentikSub: sub } });
  const byEmail = await prisma.user.findUnique({ where: { email } });

  if (byEmail && bySub && byEmail.id !== bySub.id) {
    throw new Error("This Authentik account does not match the existing MovieDB user for that email.");
  }
  if (byEmail?.authentikSub && byEmail.authentikSub !== sub) {
    throw new Error("This email is already linked to another Authentik account.");
  }

  const existing = bySub ?? byEmail;
  if (!existing && !settings.allowSignup) {
    throw new Error("There is no MovieDB account for this Authentik user. Ask an administrator to create one.");
  }

  if (!existing) {
    const username = await uniqueUsername(usernameFromProfile(profile, email));
    return prisma.user.create({
      data: {
        email,
        username,
        authentikSub: sub,
        passwordHash: null,
        role: roleFromGroups(groups, settings.adminGroup),
      },
      select: { id: true, email: true, username: true, role: true },
    });
  }

  const nextRole = roleFromGroups(groups, settings.adminGroup, existing.role);
  if (existing.role === "admin" && nextRole !== "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { email, authentikSub: sub },
        select: { id: true, email: true, username: true, role: true },
      });
    }
  }

  const emailClash = await prisma.user.findFirst({
    where: { AND: [{ id: { not: existing.id } }, { email }] },
  });
  if (emailClash) {
    throw new Error("This email is already in use.");
  }

  return prisma.user.update({
    where: { id: existing.id },
    data: { email, authentikSub: sub, role: nextRole },
    select: { id: true, email: true, username: true, role: true },
  });
}

async function uniqueUsername(base: string): Promise<string> {
  const seed = USERNAME_PATTERN.test(base) ? base : sanitizeUsername(base);
  for (let index = 0; index < 30; index += 1) {
    const suffix = index === 0 ? "" : `_${index + 1}`;
    const candidate = `${seed.slice(0, 32 - suffix.length)}${suffix}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }
  return sanitizeUsername(`u_${Date.now().toString(36)}`);
}

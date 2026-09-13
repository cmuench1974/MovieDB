import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import { decryptSecret, encryptSecret } from "./secrets";

const SMTP_KEY = "smtpSettings";

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  siteUrl: string;
};

export type PublicSmtpSettings = Omit<SmtpSettings, "password"> & { configured: boolean };

const DEFAULTS: SmtpSettings = {
  host: "",
  port: 587,
  secure: false,
  username: "",
  password: "",
  from: "",
  siteUrl: "",
};

/**
 * Nodemailer `secure: true` ist implizites TLS (SMTPS, Port 465).
 * Port 587/2525 erwartet STARTTLS (`secure: false`). Beides zu mischen
 * erzeugt OpenSSL „wrong version number“.
 */
export function smtpTlsMode(port: number, secureFlag: boolean) {
  if (port === 465) return { secure: true as const };
  if (port === 587 || port === 2525) return { secure: false as const, requireTLS: true as const };
  if (port === 25) return { secure: false as const };
  return { secure: secureFlag, requireTLS: !secureFlag };
}

function formatSmtpError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("wrong version number") || message.includes("0A00010B") || lower.includes("ssl routines")) {
    return new Error(
      "TLS does not match this SMTP port. Use 587 with STARTTLS (leave implicit TLS off) or 465 with implicit TLS on.",
    );
  }
  if (lower.includes("econnrefused")) {
    return new Error("Could not connect to the SMTP host. Check the hostname and port.");
  }
  if (lower.includes("etimedout") || lower.includes("timeout")) {
    return new Error("The SMTP server did not respond in time. Check host, port, and firewall.");
  }
  if (lower.includes("eauth") || lower.includes("invalid login") || lower.includes("authentication failed")) {
    return new Error("SMTP login failed. Check username and password.");
  }
  if (lower.includes("self-signed") || lower.includes("unable to verify")) {
    return new Error("The SMTP server certificate could not be verified.");
  }
  return error instanceof Error ? error : new Error(message);
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const stored = await prisma.appSetting.findUnique({ where: { key: SMTP_KEY } });
  if (!stored?.value) return null;
  try {
    const parsed = JSON.parse(decryptSecret(stored.value)) as Partial<SmtpSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return null;
  }
}

export async function getPublicSmtpSettings(): Promise<PublicSmtpSettings> {
  const settings = await getSmtpSettings();
  const port = settings?.port ?? 587;
  return {
    host: settings?.host ?? "",
    port,
    secure: smtpTlsMode(port, settings?.secure ?? false).secure,
    username: settings?.username ?? "",
    from: settings?.from ?? "",
    siteUrl: settings?.siteUrl ?? "",
    configured: Boolean(settings?.host && settings?.from),
  };
}

export async function saveSmtpSettings(input: {
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  from: string;
  siteUrl: string;
}): Promise<void> {
  const host = input.host.trim();
  const from = input.from.trim();
  if (!host) throw new Error("Please enter an SMTP host.");
  if (!from) throw new Error("Please enter a From address, e.g. MovieDB <noreply@example.com>.");
  const port = Number(input.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be a number such as 587 or 465.");
  }

  const existing = await getSmtpSettings();
  const password = input.password.trim() || existing?.password || "";
  const settings: SmtpSettings = {
    host,
    port,
    secure: smtpTlsMode(port, input.secure).secure,
    username: input.username.trim(),
    password,
    from,
    siteUrl: input.siteUrl.trim().replace(/\/$/, ""),
  };
  await prisma.appSetting.upsert({
    where: { key: SMTP_KEY },
    create: { key: SMTP_KEY, value: encryptSecret(JSON.stringify(settings)) },
    update: { value: encryptSecret(JSON.stringify(settings)) },
  });
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const settings = await getSmtpSettings();
  if (!settings?.host || !settings.from) {
    throw new Error("Email is not configured. Add SMTP settings in Admin first.");
  }

  const tls = smtpTlsMode(settings.port, settings.secure);
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    ...tls,
    auth: settings.username
      ? { user: settings.username, pass: settings.password }
      : undefined,
  });

  try {
    await transporter.sendMail({
      from: settings.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    throw formatSmtpError(error);
  }
}

export async function sendTestMail(to: string): Promise<void> {
  await sendMail({
    to,
    subject: "MovieDB test email",
    text: "SMTP is working. MovieDB can send account and catalog notifications.",
  });
}

export async function siteUrlFromSettings(): Promise<string> {
  const settings = await getSmtpSettings();
  return settings?.siteUrl || process.env.AUTH_URL || "http://localhost:3000";
}

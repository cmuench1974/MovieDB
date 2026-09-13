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
  return {
    host: settings?.host ?? "",
    port: settings?.port ?? 587,
    secure: settings?.secure ?? false,
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
    secure: input.secure,
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

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.username
      ? { user: settings.username, pass: settings.password }
      : undefined,
  });

  await transporter.sendMail({
    from: settings.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
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

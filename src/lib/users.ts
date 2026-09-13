import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { sendMail, siteUrlFromSettings } from "./mail";
import { welcomeEmailBody } from "./site-guide";

const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export type UserInput = {
  username: string;
  email: string;
  password?: string;
  role: string;
  notifyNewMovies: boolean;
  sendSiteGuide?: boolean;
};

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseRole(value: string): UserRole {
  return value === "admin" ? "admin" : "user";
}

function validateIdentity(username: string, email: string) {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("Username must be 3–32 characters: letters, numbers, and underscores.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
}

export async function createUser(input: UserInput) {
  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  const password = input.password ?? "";
  validateIdentity(username, email);
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (exists) {
    throw new Error("That username or email is already in use.");
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: parseRole(input.role),
      notifyNewMovies: input.notifyNewMovies,
    },
  });

  let mailError: string | undefined;
  try {
    const site = await siteUrlFromSettings();
    const includeGuide = Boolean(input.sendSiteGuide);
    await sendMail({
      to: user.email,
      subject: includeGuide ? "Your MovieDB account and how to use it" : "Your MovieDB account",
      text: welcomeEmailBody({
        username: user.username,
        email: user.email,
        role: user.role,
        siteUrl: site,
        includeGuide,
      }),
    });
  } catch (error) {
    mailError = error instanceof Error ? error.message : "Could not send the welcome email.";
  }

  return { user, mailError };
}

export async function updateUser(userId: string, input: UserInput) {
  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  validateIdentity(username, email);
  const role = parseRole(input.role);

  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw new Error("User not found.");

  if (current.role === "admin" && role !== "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      throw new Error("You cannot remove the last administrator.");
    }
  }

  const clash = await prisma.user.findFirst({
    where: {
      AND: [{ id: { not: userId } }, { OR: [{ username }, { email }] }],
    },
  });
  if (clash) throw new Error("That username or email is already in use.");

  const data: {
    username: string;
    email: string;
    role: UserRole;
    notifyNewMovies: boolean;
    passwordHash?: string;
  } = {
    username,
    email,
    role,
    notifyNewMovies: input.notifyNewMovies,
  };

  if (input.password?.trim()) {
    if (input.password.trim().length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    data.passwordHash = await bcrypt.hash(input.password.trim(), 12);
  }

  return prisma.user.update({ where: { id: userId }, data });
}

export async function deleteUser(userId: string, actorId: string) {
  if (userId === actorId) {
    throw new Error("You cannot delete your own account.");
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("User not found.");
  if (target.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      throw new Error("You cannot delete the last administrator.");
    }
  }
  await prisma.user.delete({ where: { id: userId } });
}

export async function updateOwnNotifications(userId: string, notifyNewMovies: boolean) {
  await prisma.user.update({
    where: { id: userId },
    data: { notifyNewMovies },
  });
}

export async function updateOwnCredentials(
  userId: string,
  input: { email: string; currentPassword: string; newPassword: string },
) {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }

  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw new Error("User not found.");

  const valid = await bcrypt.compare(input.currentPassword, current.passwordHash);
  if (!valid) throw new Error("Current password is incorrect.");

  const clash = await prisma.user.findFirst({
    where: { AND: [{ id: { not: userId } }, { email }] },
  });
  if (clash) throw new Error("That email is already in use.");

  const data: { email: string; passwordHash?: string } = { email };
  const nextPassword = input.newPassword.trim();
  if (nextPassword) {
    if (nextPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    data.passwordHash = await bcrypt.hash(nextPassword, 12);
  }

  return prisma.user.update({ where: { id: userId }, data });
}

export async function deleteOwnAccount(userId: string, currentPassword: string) {
  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (!current) throw new Error("User not found.");

  const valid = await bcrypt.compare(currentPassword, current.passwordHash);
  if (!valid) throw new Error("Current password is incorrect.");

  if (current.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      throw new Error("You cannot delete the last administrator.");
    }
  }

  await prisma.user.delete({ where: { id: userId } });
}

export async function listDirectoryUsers(exceptUserId?: string) {
  return prisma.user.findMany({
    where: exceptUserId ? { id: { not: exceptUserId } } : {},
    orderBy: { username: "asc" },
    select: { id: true, username: true, email: true, role: true },
  });
}

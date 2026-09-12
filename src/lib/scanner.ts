import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { FolderKind, ScanFolder } from "@prisma/client";
import {
  isVideoFile,
  parseVideoFilename,
  shouldSkipDir,
  type ParsedFilename,
} from "./filename";
import { decryptSecret } from "./secrets";
import { prisma } from "./prisma";
import { ScanStopped, yieldScanControl } from "./scan-state";
import { smbErrorMessage } from "./smb-errors";
import {
  joinSmbPath,
  smbList,
  type SmbConnection,
} from "./smb-client";

export type DiscoveredFile = {
  path: string;
  filename: string;
  parentFolder: string;
  size: bigint;
  parsed: ParsedFilename;
  folderId: string;
};

const BLOCKED_LOCAL_PREFIXES = [
  "/etc",
  "/proc",
  "/sys",
  "/root",
  "/boot",
  "/dev",
  "/usr",
  "/bin",
  "/sbin",
  "/lib",
  "/lib64",
];

export function isSafeLocalPath(input: string): boolean {
  const resolved = path.posix.normalize(input.trim());
  if (!resolved.startsWith("/") || resolved === "/" || resolved.includes("\0")) {
    return false;
  }
  return !BLOCKED_LOCAL_PREFIXES.some(
    (prefix) => resolved === prefix || resolved.startsWith(`${prefix}/`),
  );
}

export function parseSmbLocation(input: string): {
  host: string;
  share: string;
  folder?: string;
} | null {
  const normalized = input.trim().replace(/\\/g, "/").replace(/^smb:/i, "");
  const parts = normalized.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [host, share, ...rest] = parts;
  if (!isValidHost(host) || !isValidShare(share)) return null;
  return { host, share, folder: rest.join("/") || undefined };
}

export function isValidHost(host: string): boolean {
  return /^(?:[a-zA-Z0-9.-]+|\d{1,3}(?:\.\d{1,3}){3})$/.test(host) && !host.includes("..");
}

export function isValidShare(share: string): boolean {
  return /^[^\\/]+$/.test(share) && share !== "." && share !== "..";
}

export async function discoverVideoFiles(): Promise<{
  files: DiscoveredFile[];
  errors: string[];
}> {
  const folders = await prisma.scanFolder.findMany({ orderBy: { createdAt: "asc" } });
  const files: DiscoveredFile[] = [];
  const errors: string[] = [];

  for (const folder of folders) {
    await yieldScanControl();
    try {
      if (folder.kind === "local") {
        await walkLocal(folder, files);
      } else {
        await walkSmb(folder, files);
      }
      if (folder.lastError) {
        await prisma.scanFolder.update({
          where: { id: folder.id },
          data: { lastError: null },
        });
      }
    } catch (error) {
      if (error instanceof ScanStopped) throw error;
      const message = error instanceof Error ? error.message : "Folder scan failed.";
      errors.push(`${folder.label}: ${message}`);
      await prisma.scanFolder.update({
        where: { id: folder.id },
        data: { lastError: message },
      });
    }
  }

  return { files, errors };
}

export async function assertFolderReachable(input: {
  kind: FolderKind;
  path?: string;
  smbHost?: string;
  smbShare?: string;
  smbFolder?: string;
  smbDomain?: string;
  smbUsername?: string;
  smbPassword?: string;
}) {
  if (input.kind === "local") {
    const folderPath = input.path?.trim() ?? "";
    if (!isSafeLocalPath(folderPath)) {
      throw new Error("Use an absolute folder path such as /media/movies.");
    }
    await access(/* turbopackIgnore: true */ folderPath);
    const info = await stat(/* turbopackIgnore: true */ folderPath);
    if (!info.isDirectory()) {
      throw new Error("That path is not a folder.");
    }
    return;
  }

  const connection = toSmbConnection({
    host: input.smbHost ?? "",
    share: input.smbShare ?? "",
    username: input.smbUsername ?? "",
    password: input.smbPassword ?? "",
    domain: input.smbDomain ?? "",
  });
  await smbList(connection, normalizeSmbDir(input.smbFolder));
}

async function walkLocal(folder: ScanFolder, out: DiscoveredFile[]): Promise<void> {
  const root = folder.path?.trim() ?? "";
  if (!isSafeLocalPath(root)) {
    throw new Error("Local folder path is not allowed.");
  }
  await walkLocalDir(root, folder.id, out);
}

async function walkLocalDir(
  dir: string,
  folderId: string,
  out: DiscoveredFile[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Cannot read folder ${dir}: ${String(error)}`);
  }

  for (const entry of entries) {
    await yieldScanControl();
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      await walkLocalDir(fullPath, folderId, out);
      continue;
    }
    if (!entry.isFile() || !isVideoFile(entry.name)) continue;
    const info = await stat(/* turbopackIgnore: true */ fullPath);
    out.push(toDiscovered(fullPath, entry.name, path.basename(dir), BigInt(info.size), folderId));
  }
}

async function walkSmb(folder: ScanFolder, out: DiscoveredFile[]): Promise<void> {
  if (!folder.smbHost || !folder.smbShare) {
    throw new Error("SMB folder is missing host or share.");
  }
  const connection = toSmbConnection({
    host: folder.smbHost,
    share: folder.smbShare,
    username: folder.smbUsername ?? "",
    password: folder.smbPassword ? decryptSecret(folder.smbPassword) : "",
    domain: folder.smbDomain ?? "",
  });

  try {
    await walkSmbDir(connection, folder, normalizeSmbDir(folder.smbFolder), out);
  } catch (error) {
    throw new Error(smbErrorMessage(error));
  }
}

async function walkSmbDir(
  connection: SmbConnection,
  folder: ScanFolder,
  dir: string,
  out: DiscoveredFile[],
): Promise<void> {
  const entries = await smbList(connection, dir, { skipReachabilityCheck: true });
  for (const entry of entries) {
    await yieldScanControl();
    if (shouldSkipDir(entry.name) || entry.name === "." || entry.name === "..") continue;
    const rel = joinSmbPath(dir, entry.name);
    if (entry.isDirectory) {
      await walkSmbDir(connection, folder, rel, out);
      continue;
    }
    if (!isVideoFile(entry.name)) continue;
    const parent = dir === "." ? folder.smbShare ?? "share" : path.posix.basename(dir);
    const virtualPath = `smb://${folder.smbHost}/${folder.smbShare}/${rel}`;
    out.push(toDiscovered(virtualPath, entry.name, parent, entry.size, folder.id));
  }
}

function toSmbConnection(input: {
  host: string;
  share: string;
  username: string;
  password: string;
  domain: string;
}): SmbConnection {
  if (!isValidHost(input.host) || !isValidShare(input.share)) {
    throw new Error("SMB host or share name is invalid.");
  }
  if (!input.username && !process.env.SMB_BRIDGE_URL) {
    throw new Error("SMB username is required (use Guest for public shares).");
  }
  return {
    host: input.host,
    share: input.share,
    username: input.username,
    password: input.password,
    domain: input.domain || undefined,
  };
}

function normalizeSmbDir(folder?: string | null): string {
  const cleaned = (folder ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return cleaned || ".";
}

function toDiscovered(
  filePath: string,
  filename: string,
  parentFolder: string,
  size: bigint,
  folderId: string,
): DiscoveredFile {
  return {
    path: filePath,
    filename,
    parentFolder,
    size,
    folderId,
    parsed: parseVideoFilename(filename, parentFolder),
  };
}

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

export async function discoverVideoFiles(
  onFile?: (count: number, filename: string) => void,
): Promise<{
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
        await walkLocal(folder, files, onFile);
      } else {
        await walkSmb(folder, files, onFile);
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

/**
 * Löst einen vom Admin eingegebenen Pfad auf eine Datei in einem Scan-Ordner auf,
 * ohne den ganzen Share zu durchlaufen.
 */
export async function discoverVideoFile(
  userPath: string,
  folderId?: string,
): Promise<DiscoveredFile> {
  const input = userPath.trim();
  if (!input) throw new Error("Enter a video file path.");
  if (/^[a-zA-Z]:[\\/]/.test(input)) {
    throw new Error(
      "Windows drive letters are not visible in the container. Use smb://host/share/folder/file.mkv or a path under a configured local folder.",
    );
  }

  const folders = folderId
    ? await prisma.scanFolder.findMany({ where: { id: folderId } })
    : await prisma.scanFolder.findMany({ orderBy: { createdAt: "asc" } });
  if (folders.length === 0) {
    throw new Error(folderId ? "Folder not found." : "Add a scan folder under Settings first.");
  }

  const matches: { folder: ScanFolder; rel: string }[] = [];
  for (const folder of folders) {
    const rel = relativePathInFolder(folder, input);
    if (rel) matches.push({ folder, rel });
  }

  if (matches.length === 0) {
    throw new Error(
      "That path is not inside a configured scan folder. Pick the folder and use a path under it.",
    );
  }
  if (matches.length > 1) {
    throw new Error("That path matches more than one folder. Choose the folder in the list.");
  }

  const { folder, rel } = matches[0];
  if (folder.kind === "local") {
    return statLocalFile(folder, rel);
  }
  return statSmbFile(folder, rel);
}

export type ScanFolderBrowserEntry = {
  name: string;
  isDirectory: boolean;
  importPath: string | null;
};

export type ScanFolderBrowserListing = {
  relativeDir: string;
  parentDir: string | null;
  entries: ScanFolderBrowserEntry[];
};

/** Eine Ebene in einem Scan-Ordner. relativeDir "" ist die Wurzel des Shares. */
export async function listScanFolderDir(
  folderId: string,
  relativeDir: string,
): Promise<ScanFolderBrowserListing> {
  const folder = await prisma.scanFolder.findUnique({ where: { id: folderId } });
  if (!folder) throw new Error("Folder not found.");

  const relative = normalizeBrowserDir(relativeDir);
  const parentDir = relative.includes("/")
    ? relative.slice(0, relative.lastIndexOf("/"))
    : relative
      ? ""
      : null;

  const entries =
    folder.kind === "local"
      ? await listLocalDir(folder, relative)
      : await listSmbDir(folder, relative);

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return { relativeDir: relative, parentDir, entries };
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

async function walkLocal(
  folder: ScanFolder,
  out: DiscoveredFile[],
  onFile?: (count: number, filename: string) => void,
): Promise<void> {
  const root = folder.path?.trim() ?? "";
  if (!isSafeLocalPath(root)) {
    throw new Error("Local folder path is not allowed.");
  }
  await walkLocalDir(root, folder.id, out, onFile);
}

async function walkLocalDir(
  dir: string,
  folderId: string,
  out: DiscoveredFile[],
  onFile?: (count: number, filename: string) => void,
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
      await walkLocalDir(fullPath, folderId, out, onFile);
      continue;
    }
    if (!entry.isFile() || !isVideoFile(entry.name)) continue;
    const info = await stat(/* turbopackIgnore: true */ fullPath);
    out.push(toDiscovered(fullPath, entry.name, path.basename(dir), BigInt(info.size), folderId));
    onFile?.(out.length, entry.name);
  }
}

async function walkSmb(
  folder: ScanFolder,
  out: DiscoveredFile[],
  onFile?: (count: number, filename: string) => void,
): Promise<void> {
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
    await walkSmbDir(connection, folder, normalizeSmbDir(folder.smbFolder), out, onFile);
  } catch (error) {
    throw new Error(smbErrorMessage(error));
  }
}

async function walkSmbDir(
  connection: SmbConnection,
  folder: ScanFolder,
  dir: string,
  out: DiscoveredFile[],
  onFile?: (count: number, filename: string) => void,
): Promise<void> {
  const entries = await smbList(connection, dir, { skipReachabilityCheck: true });
  for (const entry of entries) {
    await yieldScanControl();
    if (shouldSkipDir(entry.name) || entry.name === "." || entry.name === "..") continue;
    const rel = joinSmbPath(dir, entry.name);
    if (entry.isDirectory) {
      await walkSmbDir(connection, folder, rel, out, onFile);
      continue;
    }
    if (!isVideoFile(entry.name)) continue;
    const parent = dir === "." ? folder.smbShare ?? "share" : path.posix.basename(dir);
    const virtualPath = `smb://${folder.smbHost}/${folder.smbShare}/${rel}`;
    out.push(toDiscovered(virtualPath, entry.name, parent, entry.size, folder.id));
    onFile?.(out.length, entry.name);
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

function relativePathInFolder(folder: ScanFolder, input: string): string | null {
  const slash = input.trim().replace(/\\/g, "/");
  const looksRemote = /^(smb:)/i.test(slash) || slash.startsWith("//");

  if (folder.kind === "local") {
    if (looksRemote) return null;
    const root = (folder.path ?? "").replace(/\/+$/, "");
    if (!root) return null;
    const candidate = slash.startsWith("/")
      ? path.posix.normalize(slash)
      : path.posix.normalize(`${root}/${slash.replace(/^\/+/, "")}`);
    if (candidate === root || !candidate.startsWith(`${root}/`)) return null;
    const rel = candidate.slice(root.length + 1);
    return isSafeRelative(rel) ? rel : null;
  }

  const parsed = looksRemote ? parseSmbLocation(slash) : null;
  let rel: string;
  if (parsed) {
    if (parsed.host.toLowerCase() !== (folder.smbHost ?? "").toLowerCase()) return null;
    if (parsed.share.toLowerCase() !== (folder.smbShare ?? "").toLowerCase()) return null;
    rel = (parsed.folder ?? "").replace(/^\/+|\/+$/g, "");
  } else if (looksRemote) {
    return null;
  } else if (slash.startsWith("/")) {
    return null;
  } else {
    rel = slash.replace(/^\/+/, "");
    const prefix = (folder.smbFolder ?? "").replace(/^\/+|\/+$/g, "");
    if (
      prefix &&
      rel.toLowerCase() !== prefix.toLowerCase() &&
      !rel.toLowerCase().startsWith(`${prefix.toLowerCase()}/`)
    ) {
      rel = `${prefix}/${rel}`;
    }
  }

  if (!isSafeRelative(rel)) return null;

  const prefix = (folder.smbFolder ?? "").replace(/^\/+|\/+$/g, "");
  if (prefix) {
    const lower = rel.toLowerCase();
    if (lower !== prefix.toLowerCase() && !lower.startsWith(`${prefix.toLowerCase()}/`)) {
      return null;
    }
  }
  return rel;
}

function isSafeRelative(rel: string): boolean {
  if (!rel || rel.includes("\0")) return false;
  const parts = rel.split("/").filter(Boolean);
  return parts.length > 0 && parts.every((part) => part !== "." && part !== "..");
}

function normalizeBrowserDir(input: string): string {
  const rel = input.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!rel) return "";
  if (!isSafeRelative(rel)) throw new Error("Invalid folder path.");
  return rel;
}

async function listLocalDir(folder: ScanFolder, relative: string): Promise<ScanFolderBrowserEntry[]> {
  const root = (folder.path ?? "").replace(/\/+$/, "");
  if (!root || !isSafeLocalPath(root)) {
    throw new Error("Local folder path is not allowed.");
  }
  const dir = relative ? path.posix.normalize(`${root}/${relative}`) : root;
  if (dir !== root && !dir.startsWith(`${root}/`)) {
    throw new Error("That path is outside the scan folder.");
  }
  if (!isSafeLocalPath(dir)) {
    throw new Error("That local path is not allowed.");
  }

  const listing = await readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true });
  const entries: ScanFolderBrowserEntry[] = [];
  for (const entry of listing) {
    if (shouldSkipDir(entry.name) || entry.name === "." || entry.name === "..") continue;
    if (entry.isDirectory()) {
      entries.push({ name: entry.name, isDirectory: true, importPath: null });
      continue;
    }
    if (!entry.isFile() || !isVideoFile(entry.name)) continue;
    entries.push({
      name: entry.name,
      isDirectory: false,
      importPath: path.posix.join(dir, entry.name),
    });
  }
  return entries;
}

async function listSmbDir(folder: ScanFolder, relative: string): Promise<ScanFolderBrowserEntry[]> {
  if (!folder.smbHost || !folder.smbShare) {
    throw new Error("SMB folder is missing host or share.");
  }
  const root = normalizeSmbDir(folder.smbFolder);
  const dir = relative ? joinSmbPath(root === "." ? "" : root, relative) : root;
  const connection = toSmbConnection({
    host: folder.smbHost,
    share: folder.smbShare,
    username: folder.smbUsername ?? "",
    password: folder.smbPassword ? decryptSecret(folder.smbPassword) : "",
    domain: folder.smbDomain ?? "",
  });

  try {
    const listing = await smbList(connection, normalizeSmbDir(dir));
    const entries: ScanFolderBrowserEntry[] = [];
    for (const entry of listing) {
      if (shouldSkipDir(entry.name) || entry.name === "." || entry.name === "..") continue;
      const childRel = joinSmbPath(normalizeSmbDir(dir) === "." ? "" : dir, entry.name);
      if (entry.isDirectory) {
        entries.push({ name: entry.name, isDirectory: true, importPath: null });
        continue;
      }
      if (!isVideoFile(entry.name)) continue;
      entries.push({
        name: entry.name,
        isDirectory: false,
        importPath: `smb://${folder.smbHost}/${folder.smbShare}/${childRel}`,
      });
    }
    return entries;
  } catch (error) {
    throw new Error(smbErrorMessage(error));
  }
}

async function statLocalFile(folder: ScanFolder, rel: string): Promise<DiscoveredFile> {
  const root = (folder.path ?? "").replace(/\/+$/, "");
  const fullPath = path.posix.join(root, rel);
  if (!isSafeLocalPath(fullPath)) {
    throw new Error("That local path is not allowed.");
  }
  try {
    const info = await stat(/* turbopackIgnore: true */ fullPath);
    if (!info.isFile()) throw new Error("That path is not a file.");
    const filename = path.posix.basename(fullPath);
    if (!isVideoFile(filename)) {
      throw new Error("Use a video file such as .mkv, .mp4, .avi, .m4v, .mov, .webm, or .iso.");
    }
    return toDiscovered(fullPath, filename, path.posix.basename(path.posix.dirname(fullPath)), BigInt(info.size), folder.id);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Use a video")) throw error;
    if (error instanceof Error && error.message.startsWith("That path")) throw error;
    throw new Error(`Cannot read that file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function statSmbFile(folder: ScanFolder, rel: string): Promise<DiscoveredFile> {
  if (!folder.smbHost || !folder.smbShare) {
    throw new Error("SMB folder is missing host or share.");
  }
  const slash = rel.replace(/\\/g, "/");
  const slashIndex = slash.lastIndexOf("/");
  const dir = slashIndex === -1 ? "." : slash.slice(0, slashIndex);
  const wantName = slashIndex === -1 ? slash : slash.slice(slashIndex + 1);
  if (!isVideoFile(wantName)) {
    throw new Error("Use a video file such as .mkv, .mp4, .avi, .m4v, .mov, .webm, or .iso.");
  }

  const connection = toSmbConnection({
    host: folder.smbHost,
    share: folder.smbShare,
    username: folder.smbUsername ?? "",
    password: folder.smbPassword ? decryptSecret(folder.smbPassword) : "",
    domain: folder.smbDomain ?? "",
  });

  try {
    const entries = await smbList(connection, normalizeSmbDir(dir));
    const entry =
      entries.find((item) => !item.isDirectory && item.name === wantName) ??
      entries.find((item) => !item.isDirectory && item.name.toLowerCase() === wantName.toLowerCase());
    if (!entry) {
      throw new Error(`File not found on the share: ${wantName}`);
    }
    const actualRel = joinSmbPath(normalizeSmbDir(dir) === "." ? "" : dir, entry.name);
    const virtualPath = `smb://${folder.smbHost}/${folder.smbShare}/${actualRel}`;
    const parent = dir === "." ? folder.smbShare : path.posix.basename(dir);
    return toDiscovered(virtualPath, entry.name, parent, entry.size, folder.id);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("File not found")) throw error;
    if (error instanceof Error && error.message.startsWith("Use a video")) throw error;
    throw new Error(smbErrorMessage(error));
  }
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

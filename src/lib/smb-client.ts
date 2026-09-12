import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { smbErrorMessage } from "./smb-errors";

export type SmbConnection = {
  host: string;
  share: string;
  folder?: string;
  username: string;
  password: string;
  domain?: string;
};

export type SmbListEntry = {
  name: string;
  isDirectory: boolean;
  size: bigint;
};

const CONNECT_TIMEOUT_MS = 12000;
const LS_TIMEOUT_MS = 30000;

export async function resolveSmbHost(host: string): Promise<string> {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return host;
  try {
    const { address } = await lookup(host, { family: 4 });
    return address;
  } catch {
    throw new Error(
      `Cannot resolve host “${host}”. Use the NAS IP address instead of a Windows computer name.`,
    );
  }
}

export async function assertSmbPortOpen(host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect({ host, port: 445 });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(
        new Error(
          "Timed out connecting to port 445 from Docker. The NAS is on your LAN, but Docker Desktop uses a VM — try the NAS IP, or mount the share on Windows and set MEDIA_PATH.",
        ),
      );
    }, CONNECT_TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function smbList(
  connection: SmbConnection,
  remoteDir: string,
  options?: { skipReachabilityCheck?: boolean },
): Promise<SmbListEntry[]> {
  const bridgeError = await trySmbBridge(connection, remoteDir);
  if (bridgeError.ok) return bridgeError.entries;
  if (!bridgeError.unreachable) {
    throw new Error(smbErrorMessage(bridgeError.error));
  }

  const address = await resolveSmbHost(connection.host);
  if (!options?.skipReachabilityCheck) {
    try {
      await assertSmbPortOpen(address);
    } catch (error) {
      throw new Error(smbErrorMessage(bridgeError.error ?? error));
    }
  }

  const dialects = ["SMB3", "SMB2"] as const;
  let lastError: unknown = bridgeError.error;
  for (const dialect of dialects) {
    try {
      return await smbListOnce(address, connection, remoteDir, dialect);
    } catch (error) {
      lastError = error;
      const text = error instanceof Error ? error.message : String(error);
      if (/LOGON_FAILURE|ACCESS_DENIED|BAD_NETWORK_NAME|WRONG_PASSWORD/i.test(text)) {
        break;
      }
    }
  }
  throw new Error(smbErrorMessage(lastError));
}

type BridgeResult =
  | { ok: true; entries: SmbListEntry[] }
  | { ok: false; unreachable: true; error?: unknown }
  | { ok: false; unreachable: false; error: unknown };

async function trySmbBridge(connection: SmbConnection, remoteDir: string): Promise<BridgeResult> {
  const baseUrl = process.env.SMB_BRIDGE_URL?.trim();
  const token = process.env.SMB_BRIDGE_TOKEN?.trim();
  if (!baseUrl || !token) return { ok: false, unreachable: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        host: connection.host,
        share: connection.share,
        folder: remoteDir === "." ? "" : remoteDir,
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as {
      entries?: { name: string; isDirectory: boolean; size: number | string }[];
      error?: string;
    };
    if (!response.ok) {
      const error = new Error(payload.error || `SMB bridge HTTP ${response.status}`);
      // Auth/config problems: fall through to smbclient. Share errors stay.
      if (response.status === 401 || response.status === 404) {
        return { ok: false, unreachable: true, error };
      }
      return { ok: false, unreachable: false, error };
    }
    const entries = (payload.entries ?? []).map((entry) => ({
      name: entry.name,
      isDirectory: Boolean(entry.isDirectory),
      size: BigInt(entry.size ?? 0),
    }));
    return { ok: true, entries };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        unreachable: true,
        error: new Error("Timed out talking to the Windows SMB bridge."),
      };
    }
    return { ok: false, unreachable: true, error };
  } finally {
    clearTimeout(timer);
  }
}

async function smbListOnce(
  address: string,
  connection: SmbConnection,
  remoteDir: string,
  dialect: "SMB3" | "SMB2",
): Promise<SmbListEntry[]> {
  const authDir = await mkdtemp(path.join(tmpdir(), "moviedb-smb-"));
  const authFile = path.join(authDir, "auth");
  const authLines = [
    `username = ${sanitizeAuthValue(connection.username)}`,
    `password = ${sanitizeAuthValue(connection.password)}`,
  ];
  if (connection.domain) {
    authLines.push(`domain = ${sanitizeAuthValue(connection.domain)}`);
  }
  await writeFile(authFile, `${authLines.join("\n")}\n`, { mode: 0o600 });

  const remote = normalizeRemoteDir(remoteDir);
  const cdPath = escapeSmbPath(remote.replace(/\//g, "\\"));
  const command = remote === "." ? "ls" : `cd "${cdPath}"; ls`;
  const args = [
    `//${address}/${connection.share}`,
    "-A",
    authFile,
    "-m",
    dialect,
    "-t",
    "20",
    "-o",
    "client min protocol=SMB2",
    "-c",
    command,
  ];
  if (!connection.password) {
    args.push("-N");
  }

  try {
    const result = await runSmbclient(args, LS_TIMEOUT_MS);
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.code !== 0) {
      throw new Error(output.trim() || `smbclient exited with code ${result.code}`);
    }
    if (/NT_STATUS_/i.test(output) && !/NT_STATUS_OK/i.test(output)) {
      throw new Error(output.trim());
    }
    return parseSmbLs(result.stdout);
  } finally {
    await rm(authDir, { recursive: true, force: true });
  }
}

function runSmbclient(
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/smbclient", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, LC_ALL: "C" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          "Timed out talking to the share. Check the IP, share name, and that SMB is allowed from Docker.",
        ),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      if ("code" in error && error.code === "ENOENT") {
        reject(
          new Error(
            "smbclient is missing in the container image. Rebuild with docker compose up --build.",
          ),
        );
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

function parseSmbLs(stdout: string): SmbListEntry[] {
  const entries: SmbListEntry[] = [];
  for (const line of stdout.split("\n")) {
    const match = line.match(
      /^\s+(.*\S)\s+([A-Z]+)\s+(\d+)\s+[A-Z][a-z]{2} [A-Z][a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2} \d{4}\s*$/,
    );
    if (!match) continue;
    const name = match[1].trim();
    if (!name || name === "." || name === "..") continue;
    entries.push({
      name,
      isDirectory: match[2].includes("D"),
      size: BigInt(match[3]),
    });
  }
  return entries;
}

function normalizeRemoteDir(folder?: string | null): string {
  const cleaned = (folder ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return cleaned || ".";
}

function escapeSmbPath(remote: string): string {
  return remote.replace(/"/g, '\\"');
}

function sanitizeAuthValue(value: string): string {
  return value.replace(/[\r\n]/g, "");
}

export function joinSmbPath(dir: string, name: string): string {
  if (!dir || dir === ".") return name;
  return `${dir.replace(/\\/g, "/")}/${name}`;
}

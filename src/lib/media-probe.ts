import { spawn } from "node:child_process";
import { extname } from "node:path";
import type { Prisma, ScanFolder, VideoFile } from "@prisma/client";
import { prisma } from "./prisma";
import {
  hintsFromFilename,
  mergeHdrFormat,
  mergeResolutionClass,
  resolutionClassFromProbe,
  type AudioTrackInfo,
  type SubtitleTrackInfo,
} from "./media-info";
import { decryptSecret } from "./secrets";
import { smbGetProbeSample } from "./smb-client";

const PROBE_TIMEOUT_MS = 45_000;
const SKIP_PROBE_EXTENSIONS = new Set([".iso"]);

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  channels?: number;
  channel_layout?: string;
  color_transfer?: string;
  color_primaries?: string;
  tags?: Record<string, string>;
  disposition?: { default?: number; forced?: number };
  side_data_list?: { side_data_type?: string }[];
};

type FfprobeOutput = {
  format?: { duration?: string };
  streams?: FfprobeStream[];
};

type ProbeResult = {
  width: number | null;
  height: number | null;
  resolutionClass: string | null;
  hdrFormat: string | null;
  durationSec: number | null;
  videoCodec: string | null;
  audioTracks: AudioTrackInfo[];
  subtitleTracks: SubtitleTrackInfo[];
  probeError: string | null;
};

export async function probeVideoIfNeeded(fileId: string): Promise<void> {
  const file = await prisma.videoFile.findUnique({
    where: { id: fileId },
    include: { folder: true },
  });
  if (!file) return;

  const result = await probeVideoFile(file);
  await prisma.videoFile.update({
    where: { id: file.id },
    data: {
      width: result.width,
      height: result.height,
      resolutionClass: result.resolutionClass,
      hdrFormat: result.hdrFormat,
      durationSec: result.durationSec,
      videoCodec: result.videoCodec,
      audioTracks: result.audioTracks as unknown as Prisma.InputJsonValue,
      subtitleTracks: result.subtitleTracks as unknown as Prisma.InputJsonValue,
      probeError: result.probeError,
      probedAt: new Date(),
    },
  });
}

export async function probeVideoFile(
  file: VideoFile & { folder: ScanFolder | null },
): Promise<ProbeResult> {
  const hints = hintsFromFilename(file.filename);
  const extension = extname(file.filename).toLowerCase();

  if (SKIP_PROBE_EXTENSIONS.has(extension)) {
    return {
      width: null,
      height: null,
      resolutionClass: hints.resolutionClass,
      hdrFormat: hints.hdrFormat,
      durationSec: null,
      videoCodec: null,
      audioTracks: [],
      subtitleTracks: [],
      probeError: "Disc images are not probed; format is taken from the filename.",
    };
  }

  try {
    const json = file.path.startsWith("smb://")
      ? await probeSmbPath(file)
      : await runFfprobe(["-i", file.path]);
    const parsed = parseFfprobe(json);
    return {
      ...parsed,
      resolutionClass: mergeResolutionClass(
        resolutionClassFromProbe(parsed.width, parsed.height),
        hints.resolutionClass,
      ),
      hdrFormat: mergeHdrFormat(parsed.hdrFormat, hints.hdrFormat),
      probeError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ffprobe failed.";
    return {
      width: null,
      height: null,
      resolutionClass: hints.resolutionClass,
      hdrFormat: hints.hdrFormat,
      durationSec: null,
      videoCodec: null,
      audioTracks: [],
      subtitleTracks: [],
      probeError: trimProbeError(message),
    };
  }
}

async function probeSmbPath(file: VideoFile & { folder: ScanFolder | null }): Promise<FfprobeOutput> {
  if (!file.folder || file.folder.kind !== "smb") {
    throw new Error("SMB file is missing folder credentials.");
  }
  const remote = remotePathFromVirtual(file.path, file.folder);
  const connection = {
    host: file.folder.smbHost ?? "",
    share: file.folder.smbShare ?? "",
    username: file.folder.smbUsername ?? "",
    password: file.folder.smbPassword ? decryptSecret(file.folder.smbPassword) : "",
    domain: file.folder.smbDomain ?? "",
  };
  const { samplePath, cleanup } = await smbGetProbeSample(connection, remote);
  try {
    return await runFfprobe(["-i", samplePath]);
  } finally {
    await cleanup();
  }
}

function remotePathFromVirtual(virtualPath: string, folder: ScanFolder): string {
  const match = virtualPath.match(/^smb:\/\/[^/]+\/[^/]+\/(.+)$/i);
  if (match) return match[1];
  const prefix = `smb://${folder.smbHost}/${folder.smbShare}/`;
  if (virtualPath.toLowerCase().startsWith(prefix.toLowerCase())) {
    return virtualPath.slice(prefix.length);
  }
  throw new Error("Could not derive the SMB path for this file.");
}

function parseFfprobe(json: FfprobeOutput): Omit<ProbeResult, "resolutionClass" | "probeError"> {
  const streams = json.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const durationRaw = json.format?.duration ?? video?.duration;
  const durationSec = durationRaw ? Math.round(Number(durationRaw)) : null;

  return {
    width: video?.width ?? null,
    height: video?.height ?? null,
    hdrFormat: detectHdr(video),
    durationSec: Number.isFinite(durationSec) && durationSec! > 0 ? durationSec : null,
    videoCodec: video?.codec_name ?? null,
    audioTracks: streams.filter((stream) => stream.codec_type === "audio").map(toAudioTrack),
    subtitleTracks: streams
      .filter((stream) => stream.codec_type === "subtitle")
      .map(toSubtitleTrack),
  };
}

function detectHdr(stream?: FfprobeStream): string | null {
  if (!stream) return null;
  const side = (stream.side_data_list ?? []).map((item) =>
    (item.side_data_type ?? "").toLowerCase(),
  );
  const dovi = side.some((type) => type.includes("dovi") || type.includes("dolby vision"));
  const hdr10plus = side.some((type) => type.includes("hdr10+") || type.includes("smpte2094"));
  const transfer = (stream.color_transfer ?? "").toLowerCase();

  if (dovi && hdr10plus) return "Dolby Vision / HDR10+";
  if (dovi) return "Dolby Vision";
  if (hdr10plus) return "HDR10+";
  if (transfer === "smpte2084" || transfer === "smpte2086") return "HDR10";
  if (transfer === "arib-std-b67") return "HLG";
  if (transfer === "bt709" || transfer === "iec61966-2-1" || transfer === "bt601") return "SDR";
  return null;
}

function toAudioTrack(stream: FfprobeStream): AudioTrackInfo {
  return {
    language: stream.tags?.language ?? null,
    codec: stream.codec_name ?? null,
    channels: stream.channels ?? null,
    channelLayout: stream.channel_layout ?? null,
    title: stream.tags?.title ?? null,
    isDefault: stream.disposition?.default === 1,
  };
}

function toSubtitleTrack(stream: FfprobeStream): SubtitleTrackInfo {
  return {
    language: stream.tags?.language ?? null,
    codec: stream.codec_name ?? null,
    title: stream.tags?.title ?? null,
    isDefault: stream.disposition?.default === 1,
    isForced: stream.disposition?.forced === 1,
  };
}

function runFfprobe(
  inputArgs: string[],
  stdin?: NodeJS.ReadableStream | null,
): Promise<FfprobeOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-analyzeduration",
        "30000000",
        "-probesize",
        "32000000",
        ...inputArgs,
      ],
      {
        stdio: [stdin ? "pipe" : "ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timed out reading media metadata."));
    }, PROBE_TIMEOUT_MS);

    if (stdin && child.stdin) {
      stdin.pipe(child.stdin);
      stdin.on("error", () => {
        child.kill("SIGKILL");
      });
      child.stdin.on("error", () => {
        // ffprobe closes stdin once it has enough header data.
      });
    }

    if (!child.stdout || !child.stderr) {
      child.kill("SIGKILL");
      reject(new Error("Could not capture ffprobe output."));
      return;
    }

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
          new Error("ffprobe is missing in the container image. Rebuild with docker compose up --build."),
        );
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `ffprobe exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout || "{}") as FfprobeOutput);
      } catch {
        reject(new Error("ffprobe returned invalid JSON."));
      }
    });
  });
}

function trimProbeError(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 400 ? `${compact.slice(0, 397)}...` : compact;
}

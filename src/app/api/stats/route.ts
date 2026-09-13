import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getHomepageStats } from "@/lib/homepage-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configuredToken(): string {
  return process.env.STATS_API_TOKEN?.trim() ?? "";
}

function providedToken(request: Request): string {
  const header = request.headers.get("x-stats-token")?.trim() ?? "";
  if (header) return header;
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const expected = configuredToken();
  if (expected && !tokensMatch(providedToken(request), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getHomepageStats();
  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": expected ? "private, no-store" : "public, max-age=30, s-maxage=60",
    },
  });
}

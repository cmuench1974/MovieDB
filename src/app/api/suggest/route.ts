import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { catalogSuggestions } from "@/lib/suggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const genre = url.searchParams.get("genre") ?? "";
  const yearRaw = url.searchParams.get("year") ?? "";
  const year = yearRaw ? Number(yearRaw) : undefined;
  const person = url.searchParams.get("person") ?? "";
  const session = await auth();

  const result = await catalogSuggestions(q, {
    signedIn: Boolean(session?.user),
    genre: genre || undefined,
    year: year && Number.isFinite(year) ? year : undefined,
    person: person || undefined,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=15" },
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { startScan } from "@/lib/matching";
import { startMetadataRefresh } from "@/lib/tmdb-sync";
import { getScanProgress } from "@/lib/scan-state";

async function requireAdminJson() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;
  return NextResponse.json(getScanProgress());
}

export async function POST(request: Request) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { mode?: string } | null;
  const mode = body?.mode === "new" ? "new" : body?.mode === "metadata" ? "metadata" : "full";

  const result =
    mode === "metadata" ? startMetadataRefresh() : startScan(mode === "new" ? "new" : "full");
  if (!result.started) {
    return NextResponse.json({ error: result.error, ...getScanProgress() }, { status: 409 });
  }
  return NextResponse.json(getScanProgress());
}

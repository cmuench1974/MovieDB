import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { startScan } from "@/lib/matching";
import { getScanProgress } from "@/lib/scan-state";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getScanProgress());
}

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = startScan();
  if (!result.started) {
    return NextResponse.json({ error: result.error, ...getScanProgress() }, { status: 409 });
  }
  return NextResponse.json(getScanProgress());
}

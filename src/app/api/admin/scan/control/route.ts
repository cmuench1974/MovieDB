import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getScanProgress,
  requestScanPause,
  requestScanResume,
  requestScanStop,
} from "@/lib/scan-state";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;
  let ok = false;
  if (action === "pause") ok = requestScanPause();
  else if (action === "resume") ok = requestScanResume();
  else if (action === "stop") ok = requestScanStop();
  else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (!ok) {
    return NextResponse.json(
      { error: "No scan is running.", ...getScanProgress() },
      { status: 409 },
    );
  }
  return NextResponse.json(getScanProgress());
}

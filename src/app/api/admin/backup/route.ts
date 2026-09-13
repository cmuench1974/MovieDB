import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dumpDatabaseSql } from "@/lib/backup";
import { isAdminSession } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = await dumpDatabaseSql();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(sql), {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="moviedb-${stamp}.sql"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

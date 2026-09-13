import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return session;
}

export function isAdminSession(
  session: { user?: { role?: string } } | null,
): boolean {
  return session?.user?.role === "admin";
}

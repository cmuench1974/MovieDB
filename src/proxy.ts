import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Prisma-free Auth.js instance so the proxy never loads the database client.
const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  if (request.auth) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.nextUrl.origin);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*", "/lists", "/lists/:path*", "/account", "/account/:path*"],
};

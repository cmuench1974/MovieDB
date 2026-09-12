import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Edge-safe Auth.js config used by the Next.js proxy.
 * The Prisma-backed authorize() lives in auth.ts so the proxy
 * can still use the `authorized` callback without extra DB calls.
 */
export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Credentials],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        return !!auth;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;

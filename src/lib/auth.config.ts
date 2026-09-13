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
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : "";
        session.user.role = token.role === "admin" ? "admin" : "user";
        session.user.username =
          typeof token.username === "string" ? token.username : "";
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        return !!auth;
      }
      if (pathname.startsWith("/lists") || pathname.startsWith("/account")) {
        return !!auth;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "admin" | "user";
    username: string;
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
      username: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "user";
    username?: string;
  }
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Authentik from "next-auth/providers/authentik";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { authConfig } from "./auth.config";
import {
  getAuthentikSettings,
  upsertAuthentikUser,
  type AuthentikProfileInput,
} from "./authentik";

function profileFromOidc(account: { providerAccountId?: string | null } | null, profile?: unknown): AuthentikProfileInput {
  const record = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};
  return {
    sub: String(record.sub ?? account?.providerAccountId ?? ""),
    email: typeof record.email === "string" ? record.email : null,
    name: typeof record.name === "string" ? record.name : null,
    preferred_username: typeof record.preferred_username === "string" ? record.preferred_username : null,
    nickname: typeof record.nickname === "string" ? record.nickname : null,
    groups: record.groups,
  };
}

function credentialsProvider() {
  return Credentials({
    credentials: {
      email: { label: "Email or username", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const identifier = String(credentials.email ?? "").trim();
      const password = String(credentials.password ?? "");
      if (!identifier || !password) return null;

      const user = identifier.includes("@")
        ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
        : await prisma.user.findUnique({ where: { username: identifier.toLowerCase() } });
      if (!user?.passwordHash) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      };
    },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const authentik = await getAuthentikSettings();
  return {
    ...authConfig,
    providers: [
      credentialsProvider(),
      ...(authentik
        ? [
            Authentik({
              clientId: authentik.clientId,
              clientSecret: authentik.clientSecret,
              issuer: authentik.issuer,
              authorization: {
                params: { scope: authentik.scopes },
              },
            }),
          ]
        : []),
    ],
    callbacks: {
      ...authConfig.callbacks,
      async signIn({ account, profile }) {
        if (account?.provider !== "authentik") return true;
        try {
          await upsertAuthentikUser(profileFromOidc(account, profile));
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Authentik sign-in failed.";
          return `/login?error=${encodeURIComponent(message)}`;
        }
      },
      async jwt({ token, user, account, profile }) {
        if (account?.provider === "authentik") {
          const synced = await upsertAuthentikUser(profileFromOidc(account, profile));
          token.sub = synced.id;
          token.role = synced.role;
          token.username = synced.username;
          token.email = synced.email;
          return token;
        }
        if (user) {
          token.role = user.role;
          token.username = user.username;
          token.sub = user.id;
        }
        return token;
      },
    },
  };
});

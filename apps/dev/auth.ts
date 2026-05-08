// NextAuth v5 — GitHub OAuth provider for the developer portal.
//
// To enable in production, set in apps/dev's env:
//   AUTH_SECRET            (any 32+ random bytes)
//   AUTH_GITHUB_ID         (GitHub OAuth app client id)
//   AUTH_GITHUB_SECRET     (GitHub OAuth app client secret)
//
// In dev mode without those env vars, the route returns 503 — we
// don't ship a fake-login because session forgery on a developer
// portal would be a real security event in production.

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const hasGitHub =
  Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: hasGitHub
    ? [
        GitHub({
          clientId: process.env.AUTH_GITHUB_ID,
          clientSecret: process.env.AUTH_GITHUB_SECRET,
        }),
      ]
    : [],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
});

export const isOAuthConfigured = hasGitHub;

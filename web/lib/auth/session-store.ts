// In-memory session mirror (Phase 21 §5.1).
//
// The JWT itself lives in an httpOnly cookie. Client code reads the
// non-sensitive claims (wallet pubkey, scopes, expiry) from the BFF
// `/api/v1/auth/session` endpoint and parks them here so any
// component can read without round-tripping the cookie. The store
// never holds the JWT string; only its decoded claims.

"use client";

import { create } from "zustand";
import { ANON_SESSION, type SessionClaims } from "./scopes";

interface SessionState extends SessionClaims {
  /**
   * Mirror of the JWT for outbound `Authorization: Bearer ...`
   * headers when the BFF's same-origin cookie is not available
   * (e.g., a client component calling a different API host). Never
   * persisted — refreshed in-memory on each `bootSession()`.
   */
  jwt: string | null;
  status: "boot" | "anonymous" | "connected" | "refreshing";
  setSession(next: { claims: SessionClaims; jwt: string | null }): void;
  clearSession(): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  ...ANON_SESSION,
  jwt: null,
  status: "boot",
  setSession({ claims, jwt }) {
    set({
      ...claims,
      jwt,
      status: claims.scopes.includes("connected") ? "connected" : "anonymous",
    });
  },
  clearSession() {
    set({ ...ANON_SESSION, jwt: null, status: "anonymous" });
  },
}));

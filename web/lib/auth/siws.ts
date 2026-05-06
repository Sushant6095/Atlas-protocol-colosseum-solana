// Sign-In With Solana flow (Phase 21 §5.1).
//
// Three-step exchange against the BFF endpoints in `app/api/v1/auth`:
//
//   1. challenge — server returns a nonce + expiry pinned to the wallet pubkey
//   2. user signs the canonical message via wallet-adapter `signMessage`
//   3. verify — server verifies, sets the JWT cookie, returns claims
//
// The hook below ships this as a single `signIn()` call so route
// pages don't reimplement it.

"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAtlas } from "../sdk/useAtlas";
import { useSessionStore } from "./session-store";
import type { SessionClaims } from "./scopes";

export const SIWS_DOMAIN_TAG = "atlas.siws.v1";

/** Construct the canonical SIWS payload bytes. Server uses the
 *  same builder; never roll a different format. */
export function buildSiwsMessage(input: {
  wallet: string;
  nonce: string;
  issued_at_ms: number;
  origin: string;
}): string {
  return [
    `[${SIWS_DOMAIN_TAG}]`,
    `wallet: ${input.wallet}`,
    `origin: ${input.origin}`,
    `issued_at_ms: ${input.issued_at_ms}`,
    `nonce: ${input.nonce}`,
  ].join("\n");
}

interface SignInResult {
  ok: boolean;
  claims?: SessionClaims;
  error?: string;
}

export function useSiws(): {
  signIn: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
} {
  const wallet = useWallet();
  const atlas = useAtlas();
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  const signIn = useCallback(async (): Promise<SignInResult> => {
    if (!wallet.connected || !wallet.publicKey || !wallet.signMessage) {
      return { ok: false, error: "wallet not connected" };
    }
    const walletAddr = wallet.publicKey.toBase58();
    try {
      const challenge = await atlas.authChallenge(walletAddr);
      const message = buildSiwsMessage({
        wallet: walletAddr,
        nonce: challenge.nonce,
        issued_at_ms: Date.now(),
        origin: typeof window !== "undefined" ? window.location.origin : "atlas",
      });
      const sig = await wallet.signMessage(new TextEncoder().encode(message));
      const signature = bytesToBase64(sig);
      const verify = await atlas.authVerify({
        wallet: walletAddr,
        nonce: challenge.nonce,
        signature,
      });
      const claims: SessionClaims = {
        wallet: walletAddr,
        scopes: ["connected"],
        expires_at: verify.expires_at,
      };
      setSession({ claims, jwt: verify.jwt });
      return { ok: true, claims };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "siws failed";
      return { ok: false, error: msg };
    }
  }, [wallet, atlas, setSession]);

  const signOut = useCallback(async () => {
    try {
      // Best-effort: BFF clears the cookie. We ignore failures.
      await fetch("/api/v1/auth/signout", { method: "POST", credentials: "include" });
    } catch { /* no-op */ }
    clearSession();
  }, [clearSession]);

  return { signIn, signOut };
}

function bytesToBase64(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}

// SIWS challenge endpoint (Phase 21 §5.1, §6).
//
// POST /api/v1/auth/challenge → { nonce, expires_at }
//
// The nonce is derived from a server-only secret + wallet pubkey + slot
// so an attacker cannot predict it. We store the nonce in an httpOnly
// cookie scoped to this exchange; verify reads it back. No DB write.

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";

const NONCE_COOKIE = "atlas.siws.nonce";
const NONCE_TTL_MS = 5 * 60_000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { wallet?: string } | null;
  if (!body?.wallet || typeof body.wallet !== "string" || body.wallet.length > 64) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }
  const nonce = makeNonce(body.wallet);
  const expires_at = Date.now() + NONCE_TTL_MS;
  const res = NextResponse.json({ nonce, expires_at });
  res.cookies.set({
    name: NONCE_COOKIE,
    value: `${body.wallet}.${nonce}.${expires_at}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: Math.floor(NONCE_TTL_MS / 1000),
  });
  return res;
}

function makeNonce(wallet: string): string {
  const seed = randomBytes(16).toString("hex");
  return createHash("sha256")
    .update(seed)
    .update(":")
    .update(wallet)
    .digest("hex")
    .slice(0, 32);
}

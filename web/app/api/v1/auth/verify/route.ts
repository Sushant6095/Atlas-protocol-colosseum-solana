// SIWS verify endpoint (Phase 21 §5.1, §6).
//
// POST /api/v1/auth/verify → { jwt, refresh, expires_at }
//
// In production this delegates to atlas-public-api's auth service.
// In dev / preview we accept the local nonce cookie + return a
// short-lived JWT signed with `ATLAS_AUTH_DEV_SECRET`. The
// production cutover is a single env-var flip.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const NONCE_COOKIE = "atlas.siws.nonce";
const SESSION_COOKIE = "atlas.session";
const REFRESH_COOKIE = "atlas.refresh";
const SESSION_TTL_S = 60 * 60;
const REFRESH_TTL_S = 7 * 24 * 60 * 60;

interface VerifyBody {
  wallet: string;
  nonce: string;
  signature: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as VerifyBody | null;
  if (!body?.wallet || !body?.nonce || !body?.signature) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const cookie = req.cookies.get(NONCE_COOKIE)?.value;
  if (!cookie) {
    return NextResponse.json({ error: "no challenge" }, { status: 400 });
  }
  const [walletInCookie, nonceInCookie, expiryStr] = cookie.split(".");
  if (
    walletInCookie !== body.wallet
    || !safeEqual(nonceInCookie, body.nonce)
    || Number(expiryStr) < Date.now()
  ) {
    return NextResponse.json({ error: "challenge mismatch" }, { status: 401 });
  }
  // NB: signature verification (ed25519) is delegated to the upstream
  // auth service in production. In dev we accept the signature as a
  // proof-of-possession of the nonce — the BFF rejects requests where
  // the upstream service responds non-200.
  const upstream = await verifyUpstream(body);
  if (!upstream.ok) {
    return NextResponse.json({ error: upstream.error }, { status: 401 });
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const jwt = upstream.jwt ?? mintDevJwt(body.wallet, exp);
  const refresh = upstream.refresh ?? mintDevRefresh(body.wallet);

  const res = NextResponse.json({
    jwt,
    refresh,
    expires_at: exp,
  });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  res.cookies.set({
    name: REFRESH_COOKIE,
    value: refresh,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: REFRESH_TTL_S,
  });
  // Clear the challenge cookie — single-use.
  res.cookies.delete(NONCE_COOKIE);
  return res;
}

interface UpstreamResult {
  ok: boolean;
  jwt?: string;
  refresh?: string;
  error?: string;
}

async function verifyUpstream(_body: VerifyBody): Promise<UpstreamResult> {
  const upstream = process.env.ATLAS_AUTH_UPSTREAM_URL;
  if (!upstream) {
    // Dev mode — accept and rely on the nonce cookie's freshness.
    return { ok: true };
  }
  try {
    const r = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(_body),
    });
    if (!r.ok) return { ok: false, error: `upstream ${r.status}` };
    return (await r.json()) as UpstreamResult;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "upstream error" };
  }
}

function mintDevJwt(wallet: string, exp: number): string {
  const secret = process.env.ATLAS_AUTH_DEV_SECRET ?? "atlas-dev-secret";
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    sub: wallet,
    scopes: ["connected"],
    exp,
    iat: Math.floor(Date.now() / 1000),
    iss: "atlas.bff.dev",
  }));
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", secret).update(data).digest();
  return `${data}.${b64urlBytes(sig)}`;
}

function mintDevRefresh(wallet: string): string {
  const secret = process.env.ATLAS_AUTH_DEV_SECRET ?? "atlas-dev-secret";
  return createHmac("sha256", secret)
    .update("refresh:")
    .update(wallet)
    .update(":")
    .update(String(Date.now()))
    .digest("hex");
}

function b64url(s: string): string {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlBytes(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

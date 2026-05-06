// /api/v1/auth/session — read-only claims surface (Phase 21 §5).
//
// Returns the decoded claims of the current session cookie, or the
// anon claims if no cookie. Client code uses this on boot to hydrate
// the in-memory session store. The full JWT is also returned so the
// store can mirror it for Authorization headers when we cross a
// host boundary; the cookie remains the source of truth.

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "atlas.session";

export async function GET(req: NextRequest) {
  const jwt = req.cookies.get(SESSION_COOKIE)?.value;
  if (!jwt) {
    return NextResponse.json({
      wallet: null,
      scopes: ["anonymous"],
      expires_at: 0,
      jwt: null,
    });
  }
  const claims = decodeClaims(jwt);
  if (!claims) {
    const res = NextResponse.json({
      wallet: null,
      scopes: ["anonymous"],
      expires_at: 0,
      jwt: null,
    });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  return NextResponse.json({ ...claims, jwt });
}

interface DecodedClaims {
  wallet: string | null;
  scopes: string[];
  expires_at: number;
}

function decodeClaims(jwt: string): DecodedClaims | null {
  try {
    const [, payload] = jwt.split(".");
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    const parsed = JSON.parse(json) as { sub?: string; scopes?: string[]; exp?: number };
    return {
      wallet: parsed.sub ?? null,
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes : ["anonymous"],
      expires_at: parsed.exp ?? 0,
    };
  } catch {
    return null;
  }
}

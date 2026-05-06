// SIWS refresh endpoint (Phase 21 §5.1).
//
// POST /api/v1/auth/refresh → { jwt, expires_at }
//
// Same upstream-or-dev pattern as /verify. Reads the refresh
// cookie; rejects if missing or stale.

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "atlas.session";
const REFRESH_COOKIE = "atlas.refresh";
const SESSION_TTL_S = 60 * 60;

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json({ error: "no refresh" }, { status: 401 });
  }
  const upstream = process.env.ATLAS_AUTH_UPSTREAM_URL;
  let jwt: string | null = null;
  if (upstream) {
    try {
      const r = await fetch(`${upstream}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!r.ok) return NextResponse.json({ error: `upstream ${r.status}` }, { status: 401 });
      jwt = ((await r.json()) as { jwt?: string }).jwt ?? null;
    } catch {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
  } else {
    // Dev — extract wallet from the refresh hmac is not possible;
    // we delegate to the existing session cookie's payload.
    const session = req.cookies.get(SESSION_COOKIE)?.value;
    if (!session) return NextResponse.json({ error: "no session" }, { status: 401 });
    jwt = session;
  }
  if (!jwt) return NextResponse.json({ error: "no jwt" }, { status: 401 });
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const res = NextResponse.json({ jwt, expires_at: exp });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  return res;
}


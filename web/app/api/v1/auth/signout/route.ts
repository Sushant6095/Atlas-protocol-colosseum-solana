// /api/v1/auth/signout — clear all auth cookies (Phase 21 §5).

import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("atlas.session");
  res.cookies.delete("atlas.refresh");
  res.cookies.delete("atlas.siws.nonce");
  return res;
}

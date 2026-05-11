// GET /api/v1/proofs/[hash] — single proof receipt. Falls back to the
// first fixture with the requested hash substituted so any pasted hex
// resolves.

import { NextResponse } from "next/server";
import { findProof } from "@/lib/proofs/fixtures";

export const runtime = "edge";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ hash: string }> },
): Promise<NextResponse> {
  const { hash } = await ctx.params;
  return NextResponse.json({ proof: findProof(hash) });
}

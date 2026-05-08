// /api/v1/vaults — index of vaults the operator can see.

import { NextResponse } from "next/server";
import { listVaults } from "@/lib/fixtures/vaults";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json(
    { vaults: listVaults(), generated_at_ms: Date.now() },
    { headers: { "cache-control": "public, max-age=4, stale-while-revalidate=8" } },
  );
}

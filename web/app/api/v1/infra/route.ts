// /api/v1/infra — public observatory snapshot.
//
// Production: Rust `atlas-public-api` serves this. Hackathon-mode:
// the Next.js route returns the same shape from the deterministic
// fixture so the Observatory grid lights up without a backend.
// Swap-in by setting `NEXT_PUBLIC_ATLAS_API_BASE_URL` and the SDK
// will route through that host instead.

import { NextResponse } from "next/server";
import { buildInfraFixture } from "@/lib/fixtures/infra";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json(buildInfraFixture(), {
    headers: {
      "cache-control": "public, max-age=2, stale-while-revalidate=4",
    },
  });
}

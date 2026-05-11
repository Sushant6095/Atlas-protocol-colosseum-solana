// GET /api/v1/proofs — list of recent proof receipts. Fixture only.

import { NextResponse } from "next/server";
import { PROOFS } from "@/lib/proofs/fixtures";

export const runtime = "edge";

export function GET(): NextResponse {
  return NextResponse.json({ proofs: PROOFS });
}

// /api/v1/freshness/{vault_id} — slot freshness budget for a vault.

import { NextResponse } from "next/server";
import { buildInfraFixture } from "@/lib/fixtures/infra";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const fixture = buildInfraFixture();
  const norm = id.toLowerCase();
  const budget = fixture.freshness_budgets.find(
    (b) => b.vault_id.toLowerCase().startsWith(norm.slice(0, 8)),
  ) ?? fixture.freshness_budgets[0];
  const currentSlot = fixture.generated_at_slot;
  const lastProofSlot = currentSlot - budget.slot_drift;

  return NextResponse.json({
    budget: {
      vault_id: budget.vault_id,
      current_slot: currentSlot,
      last_proof_slot: lastProofSlot,
      slot_drift: budget.slot_drift,
      freshness_remaining_slots: budget.freshness_remaining_slots,
      verification_window_seconds_remaining: Math.round(budget.freshness_remaining_slots * 0.4),
      band: budget.band,
    },
  });
}

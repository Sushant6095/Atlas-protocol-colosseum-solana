// /vault/[id] — Vault Intelligence Terminal (Phase 21 §2.4).
// Phase 23 wires NAV, allocation, agents, last rebalance.

import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            vault intelligence
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-display text-[24px]">vault</h1>
            <IdentifierMono value={id} copy size="md" />
          </div>
        </div>
      </header>
      <Panel surface="raised" density="dense">
        <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
          Phase 23 — NAV / allocation / 7-agent panel / last rebalance.
        </p>
      </Panel>
    </div>
  );
}

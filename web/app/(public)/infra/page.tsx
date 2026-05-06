// /infra — Public Observatory (Phase 17 → wired surface in Phase 22).
//
// The 12-panel observatory: RPC latency by source × role × region,
// quorum match rate, slot lag, attribution heatmap, TPS, Jito
// landed rate, validator latency, CU consumption, proof gen,
// rebalance e2e, Pyth post latency, slot freshness budget.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "/infra · Atlas Public Observatory" };

export default function Page() {
  return (
    <div>
      <h1 className="text-display text-[40px] leading-[48px] mb-4">
        Public Observatory
      </h1>
      <p className="text-[14px] text-[color:var(--color-ink-secondary)] mb-8">
        Live infrastructure posture — zero auth, rate-limited per IP. RPC
        latency, slot drift, TPS, validator health, proof gen, bundle
        landing, freshness budget. Phase 22 wires the live panels.
      </p>
      <Panel surface="raised" density="default">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          backed by
        </p>
        <p className="mt-1 font-mono text-[12px]">/api/v1/infra · /api/v1/infra/attribution · /api/v1/freshness</p>
      </Panel>
    </div>
  );
}

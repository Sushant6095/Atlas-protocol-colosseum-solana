// /intelligence — capital flow heatmap + exposure graph (Phase 22 §9).

import { CapitalFlowHeatmap } from "@/components/intel/CapitalFlowHeatmap";
import { ExposureGraph } from "@/components/intel/ExposureGraph";

export const metadata = { title: "Intelligence · Atlas" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          intelligence · 24h rolling
        </p>
        <h1 className="text-display text-[28px] mt-2">Capital flow + cross-protocol exposure</h1>
        <p className="mt-1 text-[13px] text-[color:var(--color-ink-secondary)] max-w-[760px]">
          Inflows and outflows by asset × protocol, with provenance on every cell.
          The exposure graph below path-decays your effective risk: hover any node
          to see what would change if it vanished.
        </p>
      </header>

      <section id="heatmap">
        <CapitalFlowHeatmap />
      </section>

      <section id="exposure">
        <ExposureGraph />
      </section>
    </div>
  );
}

// /market — stablecoin flows, smart money, yield spreads (Phase 11).
// Phase 22 wires the live feed.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Market · Atlas" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display text-[28px]">Market</h1>
        <p className="text-[13px] text-[color:var(--color-ink-secondary)] mt-1">
          Stablecoin flows · smart money · yield spreads. Source:
          Atlas warehouse + Dune snapshots (provenance tagged inline).
        </p>
      </header>
      <Panel surface="raised" density="default">
        <p className="font-mono text-[12px]">/api/v1/intel/pusd</p>
      </Panel>
    </div>
  );
}

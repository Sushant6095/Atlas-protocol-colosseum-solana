// /wallet-intelligence — pre-deposit wallet analysis (Phase 11).
// Phase 22 wires the report viewer + privacy toggle (Phase 19 Tier B).

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Wallet intelligence · Atlas" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display text-[28px]">Wallet intelligence</h1>
        <p className="text-[13px] text-[color:var(--color-ink-secondary)] mt-1">
          Pre-deposit wallet analysis. Optional Phase 19 toggle runs
          the report locally; wallet data never leaves the device.
        </p>
      </header>
      <Panel surface="raised" density="default">
        <p className="font-mono text-[12px]">/api/v1/wallet-intel/{`{wallet}`}</p>
      </Panel>
    </div>
  );
}

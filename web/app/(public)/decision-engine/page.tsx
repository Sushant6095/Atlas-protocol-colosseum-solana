// /decision-engine — AI Decision Observatory (Phase 21 §2.2).
// Phase 22 wires recent rebalances + canonical explanations.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Decision Engine · Atlas" };

export default function Page() {
  return (
    <div>
      <h1 className="text-display text-[40px] leading-[48px] mb-4">
        AI Decision Observatory
      </h1>
      <p className="text-[14px] text-[color:var(--color-ink-secondary)] mb-8">
        Last-N rebalances + canonical explanations bound to the proof.
        Hover any decision to see which agent vetoed, which signal
        carried, and the consensus root.
      </p>
      <Panel surface="raised" density="default">
        <p className="font-mono text-[12px]">/api/v1/rebalance/{`{hash}`}/explanation</p>
      </Panel>
    </div>
  );
}

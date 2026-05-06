// /risk — cross-protocol risk dashboard (Phase 04 + 05).
// Phase 22 wires the OVL deviation, LIE toxicity, exposure cap panels.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Risk · Atlas" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display text-[28px]">Cross-protocol risk</h1>
        <p className="text-[13px] text-[color:var(--color-ink-secondary)] mt-1">
          Oracle-deviation envelope · LIE toxicity per pool · concentration caps · agent ensemble disagreement.
        </p>
      </header>
      <Panel surface="raised" density="default" />
    </div>
  );
}

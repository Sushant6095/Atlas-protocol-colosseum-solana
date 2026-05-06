// /intelligence — capital flow heatmap + exposure graph (Phase 11).
// Phase 22 wires the heatmap + force-directed exposure graph.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Intelligence · Atlas" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-display text-[28px]">Intelligence</h1>
        <p className="text-[13px] text-[color:var(--color-ink-secondary)] mt-1">
          24h capital flow heatmap + wallet → protocol → asset exposure graph.
        </p>
      </header>
      <Panel surface="raised" density="default">
        <p className="font-mono text-[12px]">/api/v1/intelligence/heatmap</p>
      </Panel>
    </div>
  );
}

// Architecture — interactive system diagram (Phase 22 §2).

import { SystemDiagram } from "@/components/architecture/SystemDiagram";

export const metadata = { title: "Architecture · Atlas" };

export default function Page() {
  return (
    <div className="px-20 py-16 max-w-[1440px] mx-auto">
      <header className="mb-12 max-w-[760px]">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          atlas blueprint
        </p>
        <h1 className="text-display text-[56px] leading-[64px] tracking-tight mt-2">
          The whole system, in one view.
        </h1>
        <p className="mt-4 text-[14px] text-[color:var(--color-ink-secondary)]">
          On-chain programs · pipeline stages · data sources · stores. Hover
          any node for purpose, invariants, and source files. &quot;Play story&quot;
          walks one rebalance from quorum ingestion to mainnet settlement.
        </p>
      </header>
      <SystemDiagram />
    </div>
  );
}

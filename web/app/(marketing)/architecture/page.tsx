// Architecture — interactive system diagram (Phase 21 §2.1).
// Phase 22 wires the live diagram + animated capital flows.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Architecture · Atlas" };

export default function Page() {
  return (
    <div className="px-20 py-24 max-w-[1440px] mx-auto">
      <h1 className="text-display text-[56px] leading-[64px] tracking-tight mb-6">
        Architecture
      </h1>
      <p className="max-w-[640px] text-[16px] leading-[22px] text-[color:var(--color-ink-secondary)] mb-12">
        Atlas is a verifiable AI treasury OS for Solana. Capital, models,
        proofs, settlement, and disclosure each have their own layer.
        The diagram below walks the entire pipeline — Phase 22 makes it
        interactive.
      </p>
      <Panel surface="raised" density="default">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          Phase 22
        </p>
        <p className="mt-2 text-[14px] text-[color:var(--color-ink-secondary)]">
          interactive layer · capital flow · proof timeline · agent ensemble
        </p>
      </Panel>
    </div>
  );
}

// Security — threat model + invariants (Phase 21 §2.1).
// Phase 22 wires the invariant inventory + chaos-game-day index.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Security · Atlas" };

export default function Page() {
  return (
    <div className="px-20 py-24 max-w-[1440px] mx-auto">
      <h1 className="text-display text-[56px] leading-[64px] tracking-tight mb-6">
        Security
      </h1>
      <p className="max-w-[640px] text-[16px] leading-[22px] text-[color:var(--color-ink-secondary)] mb-12">
        Threat model, invariants (I-1…I-25), CPI allowlist, mandate
        scoping, attestation independence, the disclosure ladder.
        Every claim is checkable from this page.
      </p>
      <Panel surface="raised" density="default">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          Phase 22
        </p>
        <p className="mt-2 text-[14px] text-[color:var(--color-ink-secondary)]">
          invariants index · chaos game-day status · audit log
        </p>
      </Panel>
    </div>
  );
}

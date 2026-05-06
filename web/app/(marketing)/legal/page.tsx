// Legal — custody + privacy + compliance posture (Phase 21 §2.1).
// Includes the Phase 19 §9 QVAC privacy notice contract.

import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Legal · Atlas" };

export default function Page() {
  return (
    <div className="px-20 py-24 max-w-[1440px] mx-auto">
      <h1 className="text-display text-[56px] leading-[64px] tracking-tight mb-6">
        Legal
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel surface="raised" density="default">
          <h2 className="text-display text-[20px] mb-2">Custody</h2>
          <p className="text-[14px] text-[color:var(--color-ink-secondary)]">
            Atlas is non-custodial. Users connect existing wallets via
            wallet-standard / MWA. Atlas does not own keys; recovery is
            at the wallet level.
          </p>
        </Panel>
        <Panel surface="raised" density="default">
          <h2 className="text-display text-[20px] mb-2">Privacy</h2>
          <p className="text-[14px] text-[color:var(--color-ink-secondary)]">
            On-device QVAC surfaces (pre-sign explainer, invoice OCR,
            translation, second-opinion analyst) never leave the device.
            Phase 14 (Cloak) hides amounts. Phase 18 (PER) hides
            execution paths.
          </p>
        </Panel>
        <Panel surface="raised" density="default">
          <h2 className="text-display text-[20px] mb-2">Compliance</h2>
          <p className="text-[14px] text-[color:var(--color-ink-secondary)]">
            Region permission + sanctions pre-flight via Dodo (Phase 13);
            scoped AML reads; selective disclosure for auditors via
            viewing keys.
          </p>
        </Panel>
        <Panel surface="raised" density="default">
          <h2 className="text-display text-[20px] mb-2">Disclosure</h2>
          <p className="text-[14px] text-[color:var(--color-ink-secondary)]">
            DisclosurePolicy hashes enter every proof's public input.
            ExecutionPath* scopes (Phase 18) extend the ladder for
            auditor-friendly post-hoc review.
          </p>
        </Panel>
      </div>
    </div>
  );
}

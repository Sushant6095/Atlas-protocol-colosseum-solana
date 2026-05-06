// /governance — overview (Phase 22 §13.1).

import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { AlertPill } from "@/components/primitives/AlertPill";

export const metadata = { title: "Governance · Atlas" };

const VOTES = [
  { id: "vote-001", title: "Renew rebalance keeper for vault ab12",          severity: "ok"   as const, detail: "expires in 18h · routine renewal" },
  { id: "vote-002", title: "Promote model 0xb2c3 from Audited to Approved",  severity: "ok"   as const, detail: "audit firm signature attached" },
  { id: "vote-003", title: "Tighten mandate caps on settlement keeper",      severity: "warn" as const, detail: "max_notional_total reduced 25%" },
  { id: "vote-004", title: "Add ExecutionPathPostHoc grant for Auditor X",   severity: "warn" as const, detail: "Phase 18 disclosure scope expansion" },
];

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          governance · multisig + model registry + scoped keepers
        </p>
        <h1 className="text-display text-[28px] mt-2">Governance overview</h1>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <Panel surface="raised" density="dense" className="col-span-12 sm:col-span-3">
          <Tile label="pending votes"   value={4}  hint="2 mandate renewals" />
        </Panel>
        <Panel surface="raised" density="dense" className="col-span-12 sm:col-span-3">
          <Tile label="approvals · 30d" value={12} accent="execute" />
        </Panel>
        <Panel surface="raised" density="dense" className="col-span-12 sm:col-span-3">
          <Tile label="active mandates" value={7}  hint="across 4 vaults" />
        </Panel>
        <Panel surface="raised" density="dense" className="col-span-12 sm:col-span-3">
          <Tile label="upcoming audits" value={2}  hint="model registry · scheduled" />
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-7">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              pending votes
            </p>
          </header>
          <ul className="divide-y divide-[color:var(--color-line-soft)]">
            {VOTES.map((v) => (
              <li key={v.id} className="py-3 grid grid-cols-12 items-center gap-3">
                <span className="col-span-1 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">{v.id}</span>
                <span className="col-span-7 text-[13px] text-[color:var(--color-ink-primary)]">{v.title}</span>
                <span className="col-span-3 text-[11px] text-[color:var(--color-ink-secondary)]">{v.detail}</span>
                <span className="col-span-1 flex justify-end"><AlertPill severity={v.severity}>open</AlertPill></span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-5">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">jump</p>
          </header>
          <div className="grid grid-cols-1 gap-3">
            <Link href="/governance/models" className="block rounded-[var(--radius-sm)] border border-[color:var(--color-line-soft)] hover:border-[color:var(--color-line-strong)] p-3">
              <p className="text-[13px] text-[color:var(--color-ink-primary)]">Model registry</p>
              <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">Approved / Drift-Flagged / Slashed lineage.</p>
            </Link>
            <Link href="/governance/agents" className="block rounded-[var(--radius-sm)] border border-[color:var(--color-line-soft)] hover:border-[color:var(--color-line-strong)] p-3">
              <p className="text-[13px] text-[color:var(--color-ink-primary)]">Scoped keepers</p>
              <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">7-role roster · ratcheted usage · Squads renewal flow.</p>
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

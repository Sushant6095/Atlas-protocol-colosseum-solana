// /treasury/[id]/pending — Squads pending + QVAC second-opinion analyst (Phase 23 §8.9 + Phase 19 §5).

"use client";

import { use, useState } from "react";
import { Cpu, Check, X } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill, type AlertSeverity } from "@/components/primitives/AlertPill";

interface PendingBundle {
  id: string;
  intent: "rebalance" | "payout" | "mandate_renewal" | "scope_change";
  vault: string;
  detail: string;
  proof_status: "verified" | "pending" | "rejected";
  attestation_status: "verified" | "pending" | "rejected";
  notional_usd?: number;
}

const BUNDLES: PendingBundle[] = [
  { id: "bun-001", intent: "rebalance",       vault: "ab12cdef" + "0".repeat(56), detail: "+12.0% Kamino · −8.0% Drift",                  proof_status: "verified", attestation_status: "verified", notional_usd: 380_000 },
  { id: "bun-002", intent: "payout",          vault: "01a02b03" + "0".repeat(56), detail: "$86,000 PUSD payroll batch · 12 employees",     proof_status: "verified", attestation_status: "pending",  notional_usd:  86_000 },
  { id: "bun-003", intent: "mandate_renewal", vault: "ff10ee20" + "0".repeat(56), detail: "RebalanceKeeper renewal · +24 actions · 14d window", proof_status: "pending",  attestation_status: "verified" },
  { id: "bun-004", intent: "scope_change",    vault: "deadbeef" + "0".repeat(56), detail: "Add ExecutionPathPostHoc grant · auditor X",    proof_status: "verified", attestation_status: "verified" },
];

interface AnalystOutput {
  recommendation: "approve" | "reject" | "escalate";
  confidence_bps: number;
  concerns: string[];
  unrecognised: string[];
  comparison: string;
  fields_to_check: string[];
}

const ANALYSIS: Record<string, AnalystOutput> = {
  "bun-001": {
    recommendation: "approve",
    confidence_bps: 9_200,
    concerns: [],
    unrecognised: [],
    comparison: "Consistent with last-30d allocation · risk-on regime · within mandate caps.",
    fields_to_check: ["projected_share_balance", "fees_total_lamports"],
  },
  "bun-002": {
    recommendation: "escalate",
    confidence_bps: 6_400,
    concerns: ["compliance: AML pre-flight pending for 1 of 12 recipients"],
    unrecognised: [],
    comparison: "Recipient delta from 30d cohort · novel destination wallet detected.",
    fields_to_check: ["recipient_list", "compliance_clearances"],
  },
  "bun-003": {
    recommendation: "approve",
    confidence_bps: 8_800,
    concerns: [],
    unrecognised: [],
    comparison: "Routine renewal · keeper actions_used at 92% · ratchet matches policy.",
    fields_to_check: ["valid_until_slot", "max_actions"],
  },
  "bun-004": {
    recommendation: "escalate",
    confidence_bps: 5_400,
    concerns: ["scope-expansion is multisig-only (I-21)", "auditor identity needs ops sign-off"],
    unrecognised: [],
    comparison: "Disclosure-scope expansion is rare · last similar grant 47d ago.",
    fields_to_check: ["disclosure_policy_hash", "auditor_pubkey"],
  },
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [open, setOpen] = useState<string | null>(null);
  const focused = BUNDLES.find((b) => b.id === open) ?? null;
  const analysis = focused ? ANALYSIS[focused.id] : null;

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            phase 15 · pending squads bundles · phase 19 second-opinion analyst
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-display text-[20px]">Pending approvals</h1>
            <IdentifierMono value={id} size="sm" />
          </div>
        </div>
        <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
          {BUNDLES.length} bundles awaiting your signature
        </span>
      </header>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-5">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">queue</p>
          </header>
          <ul className="space-y-2">
            {BUNDLES.map((b) => {
              const sevP: AlertSeverity = b.proof_status === "verified" ? "ok" : b.proof_status === "pending" ? "warn" : "danger";
              const sevA: AlertSeverity = b.attestation_status === "verified" ? "ok" : b.attestation_status === "pending" ? "warn" : "danger";
              const active = open === b.id;
              return (
                <li key={b.id}>
                  <button
                    onClick={() => setOpen(b.id)}
                    className={`w-full text-left p-3 rounded-[var(--radius-sm)] border ${
                      active
                        ? "border-[color:var(--color-accent-electric)]/40 bg-[color:var(--color-accent-electric)]/10"
                        : "border-[color:var(--color-line-medium)] hover:bg-[color:var(--color-line-soft)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[12px] text-[color:var(--color-ink-secondary)]">{b.id}</span>
                      <AlertPill severity="info">{b.intent.replace("_", " ")}</AlertPill>
                    </div>
                    <p className="mt-1 text-[12px] text-[color:var(--color-ink-primary)]">{b.detail}</p>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                      <IdentifierMono value={b.vault} size="xs" />
                      <span>·</span>
                      <span>proof <AlertPill severity={sevP}>{b.proof_status}</AlertPill></span>
                      <span>·</span>
                      <span>attestation <AlertPill severity={sevA}>{b.attestation_status}</AlertPill></span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          {focused && analysis ? (
            <>
              <header className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-[color:var(--color-accent-zk)]" />
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                    qvac · second-opinion analyst · runs on this device
                  </p>
                </div>
                <AlertPill severity="zk">local</AlertPill>
              </header>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 md:col-span-6 space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">recommendation</p>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-[28px] ${
                      analysis.recommendation === "approve" ? "text-[color:var(--color-accent-execute)]"
                    : analysis.recommendation === "reject"  ? "text-[color:var(--color-accent-danger)]"
                    :                                          "text-[color:var(--color-accent-warn)]"
                    }`}>
                      {analysis.recommendation}
                    </span>
                    <span className="font-mono text-[12px] text-[color:var(--color-ink-tertiary)]">
                      confidence · {(analysis.confidence_bps / 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">comparison · last 30d</p>
                  <p className="text-[12px] text-[color:var(--color-ink-secondary)]">{analysis.comparison}</p>
                </div>
                <div className="col-span-12 md:col-span-6 space-y-3">
                  {analysis.concerns.length > 0 ? (
                    <>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">concerns</p>
                      <ul className="space-y-1 font-mono text-[11px] text-[color:var(--color-accent-warn)]">
                        {analysis.concerns.map((c, i) => <li key={i}>· {c}</li>)}
                      </ul>
                    </>
                  ) : (
                    <p className="text-[12px] text-[color:var(--color-accent-execute)]">No concerns matched the failure-class catalog.</p>
                  )}
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">fields to double-check</p>
                  <ul className="space-y-1 font-mono text-[11px] text-[color:var(--color-ink-secondary)]">
                    {analysis.fields_to_check.map((f, i) => <li key={i}>· {f}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[color:var(--color-line-soft)] flex items-center gap-2">
                <Button variant="primary" size="md" disabled={analysis.recommendation !== "approve"}>
                  <Check className="h-4 w-4" /> Approve via Squads
                </Button>
                <Button variant="destructive" size="md">
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button variant="ghost" size="md">Escalate</Button>
              </div>
              <p className="mt-3 text-[10px] text-[color:var(--color-ink-tertiary)]">
                The analyst is advisory. Approval still routes through the Squads multisig and respects the
                bundle&apos;s proof + attestation status (Phase 15 I-19/I-20).
              </p>
            </>
          ) : (
            <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
              Pick a bundle on the left to load the local QVAC second-opinion analyst.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

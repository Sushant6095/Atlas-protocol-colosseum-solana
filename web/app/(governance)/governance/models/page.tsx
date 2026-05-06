// /governance/models — Model registry (Phase 22 §13.2).

import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill, type AlertSeverity } from "@/components/primitives/AlertPill";

type Status = "Draft" | "Audited" | "Approved" | "Deprecated" | "DriftFlagged" | "Slashed";

interface ModelRow {
  id: string;
  status: Status;
  family: string;
  parent?: string;
  performance_30d_bps: number;
  vaults_running: number;
}

const MODELS: ModelRow[] = [
  { id: "0xa1b2c3d4" + "0".repeat(56), status: "Approved",     family: "ranker.v3", performance_30d_bps: 920,  vaults_running: 5, parent: "0x9081...3000" },
  { id: "0xb2c3d4e5" + "0".repeat(56), status: "Audited",      family: "ranker.v3.1", performance_30d_bps: 0,  vaults_running: 0, parent: "0xa1b2...0000" },
  { id: "0xc3d4e5f6" + "0".repeat(56), status: "DriftFlagged", family: "ranker.v3", performance_30d_bps: -120, vaults_running: 1, parent: "0x9081...3000" },
  { id: "0xd4e5f607" + "0".repeat(56), status: "Deprecated",   family: "ranker.v2", performance_30d_bps: 380,  vaults_running: 0 },
  { id: "0xe5f60718" + "0".repeat(56), status: "Slashed",      family: "ranker.v3", performance_30d_bps: -680, vaults_running: 0, parent: "0x9081...3000" },
  { id: "0xf6071829" + "0".repeat(56), status: "Draft",        family: "ranker.v4", performance_30d_bps: 0,    vaults_running: 0 },
];

const STATUS_SEVERITY: Record<Status, AlertSeverity> = {
  Draft:        "muted",
  Audited:      "info",
  Approved:     "ok",
  Deprecated:   "muted",
  DriftFlagged: "warn",
  Slashed:      "danger",
};

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          model registry · lineage · audits · drift
        </p>
        <h1 className="text-display text-[28px] mt-2">Model registry</h1>
      </header>

      <Panel surface="raised" density="dense">
        <table className="w-full text-[12px] font-mono">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] text-left">
              <th className="py-2 pr-2">id</th>
              <th className="py-2 pr-2">family</th>
              <th className="py-2 pr-2">status</th>
              <th className="py-2 pr-2">parent</th>
              <th className="py-2 pr-2 text-right">30d perf</th>
              <th className="py-2 text-right">vaults</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => (
              <tr key={m.id} className="border-t border-[color:var(--color-line-soft)]">
                <td className="py-2 pr-2">
                  <Link href={`/governance/models/${m.id}`}>
                    <IdentifierMono value={m.id} size="xs" />
                  </Link>
                </td>
                <td className="py-2 pr-2 text-[color:var(--color-ink-secondary)]">{m.family}</td>
                <td className="py-2 pr-2">
                  <AlertPill severity={STATUS_SEVERITY[m.status]}>{m.status}</AlertPill>
                </td>
                <td className="py-2 pr-2">
                  {m.parent ? <IdentifierMono value={m.parent} size="xs" /> : <span className="text-[color:var(--color-ink-tertiary)]">—</span>}
                </td>
                <td className={`py-2 pr-2 text-right ${m.performance_30d_bps >= 0 ? "text-[color:var(--color-accent-execute)]" : "text-[color:var(--color-accent-danger)]"}`}>
                  {m.performance_30d_bps >= 0 ? "+" : ""}{(m.performance_30d_bps / 100).toFixed(2)}%
                </td>
                <td className="py-2 text-right">{m.vaults_running}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

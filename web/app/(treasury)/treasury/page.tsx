// /treasury — Treasury index (Phase 23 §8.1).

import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";

const TREASURIES = [
  { id: "0x" + "01".repeat(32), name: "Atlas Labs",        kind: "Business", tvl_m: 8.34, runway_p10: 142, alerts: 0, pending: 1 },
  { id: "0x" + "02".repeat(32), name: "Solana DAO",        kind: "DAO",      tvl_m: 24.6, runway_p10:  -1, alerts: 2, pending: 4 },
  { id: "0x" + "03".repeat(32), name: "Foundation Fund",   kind: "DAO",      tvl_m: 11.0, runway_p10:  62, alerts: 1, pending: 0 },
  { id: "0x" + "04".repeat(32), name: "ACME GmbH",         kind: "Business", tvl_m:  3.7, runway_p10:  41, alerts: 0, pending: 2 },
];

export const metadata = { title: "Treasury · Atlas" };

export default function Page() {
  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            treasury · membership
          </p>
          <h1 className="text-display text-[20px] mt-1">Treasury</h1>
        </div>
        <Link href="/treasury/new"><Button variant="primary" size="sm">New treasury</Button></Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {TREASURIES.map((t) => {
          const runwaySev = t.runway_p10 < 0 ? "muted" : t.runway_p10 < 30 ? "danger" : t.runway_p10 < 60 ? "warn" : "ok";
          return (
            <Link key={t.id} href={`/treasury/${t.id}`}
                  className="block rounded-[var(--radius-md)] border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)] p-4 hover:border-[color:var(--color-line-strong)]">
              <div className="flex items-center justify-between">
                <span className="text-display text-[16px]">{t.name}</span>
                <AlertPill severity="info">{t.kind}</AlertPill>
              </div>
              <p className="mt-1 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                <IdentifierMono value={t.id} size="xs" />
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">tvl</p>
                  <p className="font-mono text-[16px]">${t.tvl_m.toFixed(2)}M</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">runway p10</p>
                  <p className="font-mono text-[16px]">
                    {t.runway_p10 < 0 ? "—" : `${t.runway_p10}d`}
                  </p>
                  {t.runway_p10 >= 0
                    ? <AlertPill severity={runwaySev}>{runwayLabel(t.runway_p10)}</AlertPill>
                    : <AlertPill severity="muted">no schedule</AlertPill>}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
                <span className="text-[color:var(--color-ink-tertiary)]">alerts</span>
                <span>{t.alerts}</span>
                <span className="text-[color:var(--color-ink-tertiary)]">· pending</span>
                <span>{t.pending}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function runwayLabel(d: number): string {
  if (d < 30) return "critical";
  if (d < 60) return "constrained";
  return "healthy";
}

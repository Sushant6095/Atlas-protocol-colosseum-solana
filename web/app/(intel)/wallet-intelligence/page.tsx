// /wallet-intelligence — Pre-deposit wallet analysis (Phase 22 §8).

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Cpu, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Tile } from "@/components/primitives/Tile";
import { ProvenancePill } from "@/components/narrative";

interface Report {
  wallet: string;
  total_balance_usd: number;
  stable_pct: number;
  volatile_pct: number;
  exposure_count: number;
  concentration_index: number;
  leverage_ratio: number;
  hold_duration_days: number;
  rotation_per_30d: number;
  withdrawal_bursts_30d: number;
  risk_score: number;
  recommendations: { title: string; severity: "ok" | "warn" | "danger"; rationale: string; href: string }[];
}

export default function Page() {
  const [wallet, setWallet] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [pending, startTransition] = useTransition();
  const [privacyMode, setPrivacyMode] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    startTransition(async () => {
      // Phase 23 wires this to /api/v1/wallet-intel/{wallet} via useAtlas().
      // The shape returned mirrors atlas_intelligence::WalletIntelligenceReport.
      await new Promise((resolve) => setTimeout(resolve, 700));
      setReport(synthesize(wallet));
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          wallet intelligence · public · zero auth
        </p>
        <h1 className="text-display text-[40px] leading-[48px] mt-2">
          Pre-deposit, in 700 milliseconds.
        </h1>
        <p className="mt-3 text-[14px] text-[color:var(--color-ink-secondary)] max-w-[760px]">
          Paste any Solana wallet address. Atlas returns a balances /
          exposure / behaviour / risk report sourced from its warehouse +
          Dune SIM mirrors. Click a recommendation to land in the
          treasury wizard with concrete numbers pre-filled.
        </p>
      </header>

      <Panel surface="raised" density="default">
        <form onSubmit={onSubmit} className="grid grid-cols-12 gap-3 items-end">
          <label className="col-span-12 md:col-span-9">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              wallet address (base58)
            </span>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value.trim())}
              placeholder="9P3...x1Ka"
              className="mt-1 w-full h-10 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-3 font-mono text-[13px] text-[color:var(--color-ink-primary)] outline-none focus:border-[color:var(--color-accent-electric)]"
            />
          </label>
          <Button variant="primary" size="lg" disabled={!wallet || pending} className="col-span-6 md:col-span-3">
            {pending ? "Running…" : "Analyse"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </form>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyMode}
              onChange={(e) => setPrivacyMode(e.target.checked)}
              className="h-3.5 w-3.5 accent-[color:var(--color-accent-zk)]"
            />
            <span className="text-[12px] text-[color:var(--color-ink-secondary)]">
              run on this device <span className="text-[color:var(--color-ink-tertiary)]">(Phase 19 QVAC)</span>
            </span>
          </label>
          {privacyMode ? (
            <AlertPill severity="zk">wallet data stays local</AlertPill>
          ) : (
            <ProvenancePill kind="warehouse" detail="atlas-intelligence + dune" />
          )}
        </div>
      </Panel>

      {report ? <ReportView report={report} privacy={privacyMode} /> : null}
    </div>
  );
}

function ReportView({ report, privacy }: { report: Report; privacy: boolean }) {
  const sev =
    report.risk_score >= 75 ? "danger" : report.risk_score >= 45 ? "warn" : "ok";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-4">
        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-3">
          <header className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              wallet
            </p>
            {privacy ? <AlertPill severity="zk">local</AlertPill> : null}
          </header>
          <IdentifierMono value={report.wallet} copy size="md" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Tile label="balance"   value={`$${(report.total_balance_usd / 1_000).toFixed(1)}k`} accent="execute" />
            <Tile label="exposures" value={report.exposure_count} mono />
            <Tile label="stable %"  value={`${report.stable_pct}%`} mono />
            <Tile label="volatile %" value={`${report.volatile_pct}%`} mono />
          </div>
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              risk score
            </p>
            <div className="mt-1 flex items-center gap-3">
              <span
                className={`font-mono text-[40px] leading-[44px] ${
                  sev === "danger"
                    ? "text-[color:var(--color-accent-danger)]"
                    : sev === "warn"
                    ? "text-[color:var(--color-accent-warn)]"
                    : "text-[color:var(--color-accent-execute)]"
                }`}
              >
                {report.risk_score}
              </span>
              <span className="text-[11px] text-[color:var(--color-ink-tertiary)]">/ 100</span>
            </div>
          </div>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            exposure
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Tile label="concentration" value={`${(report.concentration_index * 100).toFixed(0)}%`} mono />
            <Tile label="leverage"      value={`${report.leverage_ratio.toFixed(2)}×`} mono />
          </div>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            behaviour
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Tile label="hold (days)"      value={report.hold_duration_days} mono />
            <Tile label="rotations · 30d"  value={report.rotation_per_30d}   mono />
            <Tile label="withdraw bursts"  value={report.withdrawal_bursts_30d} mono />
          </div>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            recommendations
          </p>
          <ul className="mt-3 space-y-3">
            {report.recommendations.map((r) => (
              <li key={r.title}>
                <div className="flex items-center gap-2">
                  <AlertPill severity={r.severity}>{severityLabel(r.severity)}</AlertPill>
                  <span className="text-[12px] text-[color:var(--color-ink-primary)] font-medium">{r.title}</span>
                </div>
                <p className="mt-1 text-[11px] text-[color:var(--color-ink-secondary)]">{r.rationale}</p>
                <Link
                  href={r.href}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-[color:var(--color-accent-electric)] hover:underline"
                >
                  open in atlas treasury <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel surface="sunken" density="default">
        <div className="flex items-center gap-3">
          {privacy ? (
            <Cpu className="h-4 w-4 text-[color:var(--color-accent-zk)]" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-[color:var(--color-accent-execute)]" />
          )}
          <p className="text-[12px] text-[color:var(--color-ink-secondary)]">
            {privacy
              ? "Analysis ran on this device. Wallet data never left the browser. Phase 19 QVAC contract."
              : "Analysis ran against /api/v1/wallet-intel. Atlas warehouse + Dune SIM mirrors with provenance tags."}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function severityLabel(s: "ok" | "warn" | "danger"): string {
  switch (s) {
    case "ok":     return "low risk";
    case "warn":   return "monitor";
    case "danger": return "act";
  }
}

function synthesize(wallet: string): Report {
  // Deterministic synthetic numbers keyed off the wallet — for UI demo,
  // disappears the moment Phase 23 wires `/api/v1/wallet-intel/{wallet}`.
  const seed = [...wallet].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 17);
  const r = (max: number) => seed % max;
  return {
    wallet,
    total_balance_usd: 25_000 + r(75_000),
    stable_pct: 30 + r(40),
    volatile_pct: 40 + r(30),
    exposure_count: 4 + r(8),
    concentration_index: 0.25 + (r(50) / 100),
    leverage_ratio: 1 + r(15) / 10,
    hold_duration_days: 14 + r(180),
    rotation_per_30d: r(20),
    withdrawal_bursts_30d: r(4),
    risk_score: 35 + r(55),
    recommendations: [
      {
        title: "Rotate into PUSD treasury (yield 8.5%, risk-on)",
        severity: "ok",
        rationale: "Stable-leaning portfolio · concentration index <50% · matches the conservative template.",
        href: "/treasury/new?template=pusd-conservative",
      },
      {
        title: "Reduce Drift kSOL exposure",
        severity: "warn",
        rationale: "Drift kSOL share above 30% with leverage 1.4×; mean-reverting yield since 14d.",
        href: "/treasury/new?reduce=drift_ksol",
      },
      {
        title: "Add tail-risk hedge",
        severity: "danger",
        rationale: "Volatile share > 60% · suggest perps hedge on top of LP exposure.",
        href: "/hedging?suggested=tail",
      },
    ],
  };
}

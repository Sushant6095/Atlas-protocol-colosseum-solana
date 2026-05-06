// /vault/[id]/agents — 7-agent ensemble cards (Phase 23 §5).

"use client";

import { use, useState } from "react";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { Sparkline } from "@/components/operator/Sparkline";
import { cn } from "@/components/primitives";

interface AgentCard {
  id: string;
  label: string;
  role: string;
  model_id: string;
  confidence: number[];
  vetoes: number[];
  accuracy_ema: number;
  recent: { slot: number; confidence_bps: number; vote: "support" | "soft_veto" | "hard_veto" }[];
  features: string[];
  veto_authority: "Soft" | "Hard";
  feature_schema_version: string;
  training_dataset_hash: string;
}

const AGENTS: AgentCard[] = [
  card("risk",       "Risk",       "Concentration + drawdown + leverage."),
  card("yield",      "Yield",      "APY ranking + decay + rotation prediction."),
  card("liquidity",  "Liquidity",  "Depth-1pct + slippage forecast."),
  card("tail-risk",  "TailRisk",   "Vol regime + tail-loss bound + crash detection."),
  card("compliance", "Compliance", "Region + sanctions + AML pre-flight."),
  card("execution",  "Execution",  "Predictive routing + bundle landing."),
  card("observer",   "Observer",   "Cross-chain mirror + signal cohort tracking."),
];

function card(id: string, label: string, role: string): AgentCard {
  const seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 13) >>> 0;
  const r = (n: number) => (Math.sin(seed + n) + 1) / 2;
  return {
    id, label, role,
    model_id: `0x${id.slice(0, 4)}` + "0".repeat(60),
    confidence: Array.from({ length: 24 }, (_, i) => 0.55 + r(i) * 0.4),
    vetoes:     Array.from({ length: 24 }, (_, i) => Math.max(0, r(i + 7) - 0.6)),
    accuracy_ema: 0.65 + r(99) * 0.3,
    recent: Array.from({ length: 5 }, (_, i) => ({
      slot: 245_000_000 + i * 480,
      confidence_bps: Math.round(6_000 + r(i + 10) * 3_500),
      vote: r(i + 13) > 0.85 ? "hard_veto" : r(i + 17) > 0.65 ? "soft_veto" : "support",
    })),
    features: [
      "feature.consensus_root",
      "feature.regime_classifier",
      `feature.${id.replace("-", "_")}_signal`,
      "feature.oracle_consensus_confidence",
    ],
    veto_authority: id === "tail-risk" || id === "compliance" ? "Hard" : "Soft",
    feature_schema_version: "v3.2",
    training_dataset_hash: "0xfeed" + "0".repeat(60),
  };
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [open, setOpen] = useState<string | null>(null);
  const focused = AGENTS.find((a) => a.id === open) ?? null;

  return (
    <div className="px-4 py-4 space-y-3">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          7-agent ensemble · vault
        </p>
        <div className="flex items-center gap-2 mt-1">
          <h1 className="text-display text-[20px]">Agents</h1>
          <IdentifierMono value={id} size="sm" />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {AGENTS.map((a) => {
          const last = a.recent[0];
          const sev = last.vote === "hard_veto" ? "danger" : last.vote === "soft_veto" ? "warn" : "ok";
          return (
            <button
              key={a.id}
              onClick={() => setOpen(a.id)}
              className={cn(
                "text-left rounded-[var(--radius-md)] border border-[color:var(--color-line-medium)]",
                "bg-[color:var(--color-surface-raised)] p-4 hover:border-[color:var(--color-line-strong)]",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-display text-[16px]">{a.label}</span>
                <AlertPill severity={sev}>{last.vote.replace("_", " ")}</AlertPill>
              </div>
              <p className="mt-1 text-[11px] text-[color:var(--color-ink-tertiary)]">{a.role}</p>
              <p className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                model · <IdentifierMono value={a.model_id} size="xs" />
              </p>
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">confidence</p>
                <Sparkline values={a.confidence} stroke="var(--color-accent-electric)" fill="var(--color-accent-electric)" height={28} />
              </div>
              <div className="mt-2">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">veto frequency</p>
                <Sparkline values={a.vetoes} stroke="var(--color-accent-warn)" height={20} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px]">
                <span className="text-[color:var(--color-ink-tertiary)]">accuracy ema</span>
                <span className="text-right">{(a.accuracy_ema * 100).toFixed(1)}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {focused ? (
        <Panel surface="raised" density="default">
          <header className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                agent detail
              </p>
              <div className="flex items-center gap-2 mt-1">
                <h2 className="text-display text-[18px]">{focused.label}</h2>
                <AlertPill severity="info">{focused.veto_authority} veto</AlertPill>
              </div>
            </div>
            <button onClick={() => setOpen(null)} className="text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-primary)] text-[12px]">
              close
            </button>
          </header>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-6">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">features read</p>
              <ul className="font-mono text-[11px] space-y-1 text-[color:var(--color-ink-secondary)]">
                {focused.features.map((f) => <li key={f}>· {f}</li>)}
              </ul>
              <p className="mt-4 text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">training metadata</p>
              <ul className="font-mono text-[11px] space-y-1 text-[color:var(--color-ink-secondary)]">
                <li>schema · {focused.feature_schema_version}</li>
                <li>dataset · <IdentifierMono value={focused.training_dataset_hash} size="xs" /></li>
                <li>model · <IdentifierMono value={focused.model_id} size="xs" /></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-6">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">recent proposals</p>
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] text-left">
                    <th className="py-1 pr-2">slot</th>
                    <th className="py-1 pr-2 text-right">confidence</th>
                    <th className="py-1 pr-2">vote</th>
                  </tr>
                </thead>
                <tbody>
                  {focused.recent.map((r) => (
                    <tr key={r.slot} className="border-t border-[color:var(--color-line-soft)]">
                      <td className="py-1 pr-2 text-[color:var(--color-ink-secondary)]">{r.slot.toLocaleString()}</td>
                      <td className="py-1 pr-2 text-right">{(r.confidence_bps / 100).toFixed(1)}%</td>
                      <td className="py-1 pr-2">
                        <AlertPill severity={r.vote === "hard_veto" ? "danger" : r.vote === "soft_veto" ? "warn" : "ok"}>
                          {r.vote.replace("_", " ")}
                        </AlertPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

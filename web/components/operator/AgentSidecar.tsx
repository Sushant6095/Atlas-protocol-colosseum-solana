// AgentSidecar — 7-agent confidence + veto sidecar (Phase 23 §2.4).

"use client";

import { memo } from "react";
import { cn } from "@/components/primitives";

export interface AgentTick {
  id: string;
  label: string;
  confidence_bps: number;
  last_vote: "support" | "soft_veto" | "hard_veto";
  trend?: number[];
}

const AGENTS: AgentTick[] = [
  { id: "risk",       label: "Risk",       confidence_bps: 8_400, last_vote: "support",   trend: spark(8) },
  { id: "yield",      label: "Yield",      confidence_bps: 6_200, last_vote: "soft_veto", trend: spark(8) },
  { id: "liquidity",  label: "Liquidity",  confidence_bps: 7_400, last_vote: "support",   trend: spark(8) },
  { id: "tail-risk",  label: "TailRisk",   confidence_bps: 9_100, last_vote: "hard_veto", trend: spark(8) },
  { id: "compliance", label: "Compliance", confidence_bps: 8_800, last_vote: "support",   trend: spark(8) },
  { id: "execution",  label: "Execution",  confidence_bps: 7_900, last_vote: "support",   trend: spark(8) },
  { id: "observer",   label: "Observer",   confidence_bps: 6_500, last_vote: "soft_veto", trend: spark(8) },
];

function spark(n: number): number[] {
  const out: number[] = [];
  let v = 0.6 + Math.random() * 0.3;
  for (let i = 0; i < n; i++) {
    v = Math.max(0.2, Math.min(1, v + (Math.random() - 0.5) * 0.18));
    out.push(v);
  }
  return out;
}

function AgentSidecarImpl({ agents = AGENTS }: { agents?: AgentTick[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] px-1">
        agents · 7
      </p>
      <ul className="space-y-1">
        {agents.map((a) => {
          const sev = voteClass(a.last_vote);
          return (
            <li key={a.id} className="px-1.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[color:var(--color-line-soft)]">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[color:var(--color-ink-primary)]">{a.label}</span>
                <span className={sev}>{a.last_vote.replace("_", " ")}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-[var(--radius-xs)] bg-[color:var(--color-line-medium)] overflow-hidden">
                  <div className={cn("h-full", barClass(a.last_vote))}
                       style={{ width: `${a.confidence_bps / 100}%` }} />
                </div>
                <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)] tabular-nums w-10 text-right">
                  {(a.confidence_bps / 100).toFixed(0)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function voteClass(v: AgentTick["last_vote"]): string {
  return v === "hard_veto" ? "text-[color:var(--color-accent-danger)]"
       : v === "soft_veto" ? "text-[color:var(--color-accent-warn)]"
       : "text-[color:var(--color-accent-execute)]";
}
function barClass(v: AgentTick["last_vote"]): string {
  return v === "hard_veto" ? "bg-[color:var(--color-accent-danger)]"
       : v === "soft_veto" ? "bg-[color:var(--color-accent-warn)]"
       : "bg-[color:var(--color-accent-execute)]";
}

export const AgentSidecar = memo(AgentSidecarImpl);
AgentSidecar.displayName = "AgentSidecar";

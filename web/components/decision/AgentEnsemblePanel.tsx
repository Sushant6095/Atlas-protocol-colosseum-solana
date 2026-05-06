// AgentEnsemblePanel — 7-agent proposals side-by-side (Phase 22 §7.2 "Who").

"use client";

import { memo } from "react";
import { Panel } from "@/components/primitives/Panel";
import { AlertPill } from "@/components/primitives/AlertPill";
import { cn } from "@/components/primitives";

const AGENTS = [
  { id: "risk",       label: "Risk",       color: "electric" as const },
  { id: "yield",      label: "Yield",      color: "execute"  as const },
  { id: "liquidity",  label: "Liquidity",  color: "zk"       as const },
  { id: "tail-risk",  label: "TailRisk",   color: "danger"   as const },
  { id: "compliance", label: "Compliance", color: "warn"     as const },
  { id: "execution",  label: "Execution",  color: "proof"    as const },
  { id: "observer",   label: "Observer",   color: "electric" as const },
] as const;

export interface AgentProposal {
  /** "risk" | "yield" | "liquidity" | "tail-risk" | "compliance" | "execution" | "observer" */
  agent: typeof AGENTS[number]["id"];
  /** 0..=10_000. */
  confidence_bps: number;
  /** "support" | "soft_veto" | "hard_veto". */
  vote: "support" | "soft_veto" | "hard_veto";
  /** One-sentence stance. */
  rationale: string;
}

export interface AgentEnsemblePanelProps {
  proposals: AgentProposal[];
  consensus_disagreement_bps: number;
}

function AgentEnsemblePanelImpl({
  proposals,
  consensus_disagreement_bps,
}: AgentEnsemblePanelProps) {
  return (
    <Panel surface="raised" density="default">
      <header className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          7-agent ensemble · who
        </p>
        <span className="font-mono text-[11px] text-[color:var(--color-ink-secondary)]">
          disagreement · {(consensus_disagreement_bps / 100).toFixed(1)}%
        </span>
      </header>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENTS.map((agent) => {
          const p = proposals.find((x) => x.agent === agent.id);
          return (
            <li
              key={agent.id}
              className="rounded-[var(--radius-sm)] border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-base)] p-3"
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-[12px]",
                    agent.color === "danger" && "text-[color:var(--color-accent-danger)]",
                    agent.color === "execute" && "text-[color:var(--color-accent-execute)]",
                    agent.color === "zk" && "text-[color:var(--color-accent-zk)]",
                    agent.color === "warn" && "text-[color:var(--color-accent-warn)]",
                    agent.color === "proof" && "text-[color:var(--color-accent-proof)]",
                    agent.color === "electric" && "text-[color:var(--color-accent-electric)]",
                  )}
                >
                  {agent.label}
                </span>
                {p ? (
                  <AlertPill
                    severity={p.vote === "hard_veto" ? "danger" : p.vote === "soft_veto" ? "warn" : "ok"}
                  >
                    {p.vote.replace("_", " ")}
                  </AlertPill>
                ) : <AlertPill severity="muted">no data</AlertPill>}
              </div>
              {p ? (
                <>
                  <div className="mt-3 h-1.5 rounded-[var(--radius-xs)] overflow-hidden bg-[color:var(--color-line-medium)]">
                    <div
                      className={cn(
                        "h-full",
                        p.vote === "hard_veto" && "bg-[color:var(--color-accent-danger)]",
                        p.vote === "soft_veto" && "bg-[color:var(--color-accent-warn)]",
                        p.vote === "support"   && "bg-[color:var(--color-accent-execute)]",
                      )}
                      style={{ width: `${p.confidence_bps / 100}%` }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                    {(p.confidence_bps / 100).toFixed(1)}% confidence
                  </p>
                  <p className="mt-2 text-[12px] text-[color:var(--color-ink-secondary)]">
                    {p.rationale}
                  </p>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export const AgentEnsemblePanel = memo(AgentEnsemblePanelImpl);
AgentEnsemblePanel.displayName = "AgentEnsemblePanel";

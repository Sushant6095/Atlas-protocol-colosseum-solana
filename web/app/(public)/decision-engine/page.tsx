// /decision-engine — AI Decision Observatory.
//
// Visual overhaul: every rebalance ships a structured explanation, an
// agent ensemble trace, and a CPI trace. The structured fields commit
// on-chain; the prose is rendered. Below the fold: filterable list
// of recent decisions.

"use client";

import { useState } from "react";
import { DecisionList } from "@/components/decision/DecisionList";
import { cn } from "@/components/primitives";

type AgentId = "risk" | "yield" | "liquidity" | "tail-risk" | "compliance" | "execution" | "observer";
type Vote = "support" | "soft_veto" | "hard_veto";

interface AgentProposal {
  agent: AgentId;
  confidence_bps: number;
  vote: Vote;
  rationale: string;
}

const FEATURED_PROPOSALS: AgentProposal[] = [
  { agent: "risk",       confidence_bps: 8_400, vote: "support",   rationale: "Drawdown bounded; concentration index 0.31." },
  { agent: "yield",      confidence_bps: 6_200, vote: "soft_veto", rationale: "Drift APY decayed 220 bps over the last 14d window." },
  { agent: "liquidity",  confidence_bps: 7_400, vote: "support",   rationale: "Depth-1pct ≥ 5× rebalance notional on every leg." },
  { agent: "tail-risk",  confidence_bps: 9_100, vote: "hard_veto", rationale: "Volatility spike severity 8100; defensive exit." },
  { agent: "compliance", confidence_bps: 8_800, vote: "support",   rationale: "All routes pass region + sanctions pre-flight." },
  { agent: "execution",  confidence_bps: 7_900, vote: "support",   rationale: "Predictive routing favours Drift-Kamino sequence." },
  { agent: "observer",   confidence_bps: 6_500, vote: "soft_veto", rationale: "Cross-chain mirror diverges by 3.4%." },
];

const FEATURED_DRIVERS = [
  { id: "vol_spike",   severity: 8_100, target: "all assets",  text: "30d realised vol breached the regime threshold." },
  { id: "drift_apy",   severity: 4_400, target: "drift kSOL",  text: "Drift kSOL APY decayed 220 bps over 14d." },
  { id: "kamino_rate", severity: 3_900, target: "kamino USDC", text: "Kamino USDC supply rate ranks above 14d median." },
  { id: "regime_flip", severity: 7_200, target: "regime flag", text: "Cross-asset regime classifier flipped neutral → defensive." },
];

const FEATURED_CPI_TRACE = [
  { ix: 0, program: "Compute Budget",   call: "set_compute_unit_limit(1_200_000)" },
  { ix: 1, program: "Pyth pull",        call: "post_update(kSOL/USDC, vlbe_..)" },
  { ix: 2, program: "Atlas Verifier",   call: "verify(public_input_v2, proof, vk_hash)" },
  { ix: 3, program: "Atlas Rebalancer", call: "execute(post_state_commitment)" },
  { ix: 4, program: "Drift v2",         call: "withdraw_collateral(kSOL, 12.0%)" },
  { ix: 5, program: "Kamino Lend",      call: "deposit(USDC, 12.0%)" },
  { ix: 6, program: "Atlas Vault",      call: "apply_post_state(after_root)" },
  { ix: 7, program: "Bubblegum",        call: "append_leaf(rebalance_receipt)" },
];

// PascalCase labels rendered in the agent cards. The data IDs use
// the wire format (lowercase, hyphenated); the labels are display-only.
const AGENT_LABEL: Record<AgentId, "Risk" | "Yield" | "Liquidity" | "TailRisk" | "Compliance" | "Execution" | "Observer"> = {
  "risk":       "Risk",
  "yield":      "Yield",
  "liquidity":  "Liquidity",
  "tail-risk":  "TailRisk",
  "compliance": "Compliance",
  "execution":  "Execution",
  "observer":   "Observer",
};

// Each agent owns one accent. The colors are token references so
// the surface still reads correctly under the light theme.
const AGENT_TOP_LINE: Record<string, string> = {
  Risk:       "bg-[color:var(--color-accent-electric)]",
  Yield:      "bg-[color:var(--color-accent-warn)]",
  Liquidity:  "bg-[color:var(--color-accent-zk)]",
  TailRisk:   "bg-[color:var(--color-accent-danger)]",
  Compliance: "bg-[color:var(--color-accent-execute)]",
  Execution:  "bg-[color:var(--color-accent-proof)]",
  Observer:   "bg-[color:var(--color-accent-warn)]",
};
const AGENT_TEXT: Record<string, string> = {
  Risk:       "text-[color:var(--color-accent-electric)]",
  Yield:      "text-[color:var(--color-accent-warn)]",
  Liquidity:  "text-[color:var(--color-accent-zk)]",
  TailRisk:   "text-[color:var(--color-accent-danger)]",
  Compliance: "text-[color:var(--color-accent-execute)]",
  Execution:  "text-[color:var(--color-accent-proof)]",
  Observer:   "text-[color:var(--color-accent-warn)]",
};
const AGENT_FILL: Record<string, string> = {
  Risk:       "bg-[color:var(--color-accent-electric)]",
  Yield:      "bg-[color:var(--color-accent-warn)]",
  Liquidity:  "bg-[color:var(--color-accent-zk)]",
  TailRisk:   "bg-[color:var(--color-accent-danger)]",
  Compliance: "bg-[color:var(--color-accent-execute)]",
  Execution:  "bg-[color:var(--color-accent-proof)]",
  Observer:   "bg-[color:var(--color-accent-warn)]",
};
const AGENT_HOVER_BORDER: Record<string, string> = {
  Risk:       "hover:border-[color:var(--color-accent-electric)]/40",
  Yield:      "hover:border-[color:var(--color-accent-warn)]/40",
  Liquidity:  "hover:border-[color:var(--color-accent-zk)]/40",
  TailRisk:   "hover:border-[color:var(--color-accent-danger)]/40",
  Compliance: "hover:border-[color:var(--color-accent-execute)]/40",
  Execution:  "hover:border-[color:var(--color-accent-proof)]/40",
  Observer:   "hover:border-[color:var(--color-accent-warn)]/40",
};

const VERDICT_LABEL: Record<Vote, "SUPPORT" | "SOFT VETO" | "HARD VETO"> = {
  support:   "SUPPORT",
  soft_veto: "SOFT VETO",
  hard_veto: "HARD VETO",
};
const VERDICT_PILL: Record<Vote, string> = {
  support:   "bg-[color:var(--color-accent-execute)]/10 text-[color:var(--color-accent-execute)]",
  soft_veto: "bg-[color:var(--color-accent-warn)]/10 text-[color:var(--color-accent-warn)]",
  hard_veto: "bg-[color:var(--color-accent-danger)]/10 text-[color:var(--color-accent-danger)]",
};

export default function Page(): JSX.Element {
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)] text-[color:var(--color-ink-primary)] -mx-6 -my-10">
      <PageHeader />
      <StructuredDriversSection />
      <AgentEnsembleSection />
      <CpiTraceSection />
      <RecentDecisionsSection />
    </div>
  );
}

// ─── §3b — page header ─────────────────────────────────────────────

function PageHeader(): JSX.Element {
  return (
    <section className="border-b border-[color:var(--color-line-soft)] px-6 pb-16 pt-24 md:px-12 md:pt-32">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]">
          AI DECISION OBSERVATORY · PUBLIC · ZERO AUTH
        </p>
        <h1 className="mt-6 font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] md:text-6xl">
          Why Atlas moved capital,
          <br />
          <span className="bg-gradient-to-r from-[color:var(--color-accent-electric)] via-[color:var(--color-accent-zk)] to-[color:var(--color-accent-proof)] bg-clip-text text-transparent">
            in three views.
          </span>
        </h1>
        <p className="mt-8 max-w-2xl font-body text-base leading-relaxed text-[color:var(--color-ink-secondary)] md:text-lg">
          Every rebalance carries a structured explanation, an agent ensemble
          trace, and a CPI trace. The structured fields commit; the prose
          renders. Below is a featured defensive-mode rebalance — the same
          drilldown is available for every rebalance via the list.
        </p>
      </div>
    </section>
  );
}

// ─── §3c+§3d — structured drivers panel ────────────────────────────

function StructuredDriversSection(): JSX.Element {
  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-7xl">
        <article className="relative overflow-hidden rounded-xl border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)] p-8 md:p-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-accent-electric)]/40 to-transparent" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[color:var(--color-accent-warn)]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-accent-warn)]">
              DEFENSIVE
            </span>
            <span className="rounded-full bg-[color:var(--color-accent-warn)]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-accent-warn)]">
              DEFENSIVE MODE
            </span>
            <span className="rounded-full bg-[color:var(--color-accent-danger)]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-accent-danger)]">
              TAIL-RISK HARD VETO
            </span>
            <span className="ml-auto font-mono text-xs text-[color:var(--color-ink-tertiary)]">
              slot 245_002_400
            </span>
            <span className="font-mono text-xs text-[color:var(--color-ink-tertiary)]">
              a1b2c3…0000
            </span>
          </div>

          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-ink-tertiary)]">
            WHY · STRUCTURED DRIVERS
          </p>

          <div className="mt-6">
            {FEATURED_DRIVERS.map((d) => (
              <DriverRow
                key={d.id}
                name={d.id}
                severity={d.severity}
                target={d.target}
                description={d.text}
              />
            ))}
          </div>

          <p className="mt-8 font-mono text-xs text-[color:var(--color-ink-tertiary)]">
            explanation_hash · poseidon over canonical bytes ·{" "}
            <span className="text-[color:var(--color-ink-secondary)]">9081a2…ffff</span>{" "}
            <em className="not-italic text-[color:var(--color-ink-tertiary)]">rendering, not commitment</em>
          </p>
        </article>
      </div>
    </section>
  );
}

interface DriverRowProps {
  name: string;
  severity: number;
  target: string;
  description: string;
}

function DriverRow({ name, severity, target, description }: DriverRowProps): JSX.Element {
  const fill =
    severity > 7000
      ? "bg-gradient-to-r from-[color:var(--color-accent-danger)]/80 to-[color:var(--color-accent-danger)]"
      : severity > 5000
      ? "bg-gradient-to-r from-[color:var(--color-accent-warn)]/80 to-[color:var(--color-accent-warn)]"
      : "bg-gradient-to-r from-[color:var(--color-accent-execute)]/80 to-[color:var(--color-accent-execute)]";

  return (
    <div className="grid grid-cols-12 items-center gap-4 border-b border-[color:var(--color-line-soft)] py-3 last:border-b-0">
      <span className="col-span-2 font-mono text-sm text-[color:var(--color-ink-primary)]">
        {name}
      </span>
      <div className="col-span-4">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out", fill)}
            style={{ width: `${(severity / 10000) * 100}%` }}
          />
        </div>
        <span className="mt-1 block font-mono text-xs text-[color:var(--color-ink-tertiary)]">
          severity {severity}
        </span>
      </div>
      <span className="col-span-2 font-mono text-sm text-[color:var(--color-ink-secondary)]">
        {target}
      </span>
      <span className="col-span-4 font-body text-sm text-[color:var(--color-ink-secondary)]">
        {description}
      </span>
    </div>
  );
}

// ─── §3e — 7-agent ensemble panel ──────────────────────────────────

function AgentEnsembleSection(): JSX.Element {
  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-7xl">
        <article className="relative overflow-hidden rounded-xl border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)] p-8 md:p-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-accent-zk)]/40 to-transparent" />

          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-ink-tertiary)]">
            7-AGENT ENSEMBLE · WHO
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURED_PROPOSALS.map((p) => {
              const label = AGENT_LABEL[p.agent];
              return (
                <AgentCard
                  key={p.agent}
                  label={label}
                  verdict={VERDICT_LABEL[p.vote]}
                  voteKey={p.vote}
                  confidence={p.confidence_bps / 100}
                  description={p.rationale}
                />
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}

interface AgentCardProps {
  label: keyof typeof AGENT_TOP_LINE;
  verdict: "SUPPORT" | "SOFT VETO" | "HARD VETO";
  voteKey: Vote;
  confidence: number;
  description: string;
}

function AgentCard({ label, verdict, voteKey, confidence, description }: AgentCardProps): JSX.Element {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-sunken)] p-5",
        "transition-colors duration-[220ms] ease-[cubic-bezier(0.20,0.80,0.20,1)]",
        "hover:bg-[color:var(--color-surface-raised)]",
        AGENT_HOVER_BORDER[label],
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-px", AGENT_TOP_LINE[label])} />

      <div className="flex items-center justify-between">
        <span className={cn("font-display text-base font-semibold", AGENT_TEXT[label])}>
          {label}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]",
            VERDICT_PILL[voteKey],
          )}
        >
          {verdict}
        </span>
      </div>

      <div className="mt-4">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-base)]">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out", AGENT_FILL[label])}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs text-[color:var(--color-ink-tertiary)]">
          {confidence.toFixed(1)}% confidence
        </p>
      </div>

      <p className="mt-3 font-body text-sm leading-relaxed text-[color:var(--color-ink-secondary)]">
        {description}
      </p>
    </div>
  );
}

// ─── §3f — CPI trace panel ─────────────────────────────────────────

function CpiTraceSection(): JSX.Element {
  return (
    <section className="px-6 py-12 md:px-12">
      <div className="mx-auto max-w-7xl">
        <article className="relative overflow-hidden rounded-xl border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-raised)] p-8 md:p-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--color-accent-execute)]/40 to-transparent" />

          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-ink-tertiary)]">
            HOW · CPI TRACE
          </p>

          <div className="mt-6 overflow-x-auto rounded-lg border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-sunken)]">
            <table className="w-full">
              <tbody>
                {FEATURED_CPI_TRACE.map((row) => (
                  <tr
                    key={row.ix}
                    className="border-b border-[color:var(--color-line-soft)] last:border-b-0 transition-colors hover:bg-[color:var(--color-surface-raised)]"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-ink-tertiary)] tabular-nums">
                      {String(row.ix).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-[color:var(--color-ink-primary)]">
                      {row.program}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-[color:var(--color-accent-zk)]">
                      {row.call}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

// ─── §3g — recent decisions panel ──────────────────────────────────

const RECENT_FILTERS: Array<{ id: "ALL" | "RISK-ON" | "NEUTRAL" | "DEFENSIVE" | "CRISIS" | "AGENT VETO"; label: string }> = [
  { id: "ALL",        label: "ALL" },
  { id: "RISK-ON",    label: "RISK-ON" },
  { id: "NEUTRAL",    label: "NEUTRAL" },
  { id: "DEFENSIVE",  label: "DEFENSIVE" },
  { id: "CRISIS",     label: "CRISIS" },
  { id: "AGENT VETO", label: "AGENT VETO" },
];

function RecentDecisionsSection(): JSX.Element {
  const [active, setActive] = useState<typeof RECENT_FILTERS[number]["id"]>("ALL");

  return (
    <section className="px-6 pb-24 pt-12 md:px-12">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-ink-tertiary)]">
          RECENT DECISIONS · FILTER BY REGIME / VETO
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {RECENT_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={cn(
                "rounded-full px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] transition-colors",
                active === f.id
                  ? "border border-[color:var(--color-accent-electric)] bg-[color:var(--color-accent-electric)]/10 text-[color:var(--color-accent-electric)]"
                  : "border border-[color:var(--color-line-medium)] bg-[color:var(--color-surface-sunken)] text-[color:var(--color-ink-tertiary)] hover:border-[color:var(--color-line-strong)] hover:text-[color:var(--color-ink-secondary)]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <DecisionList />
        </div>
      </div>
    </section>
  );
}

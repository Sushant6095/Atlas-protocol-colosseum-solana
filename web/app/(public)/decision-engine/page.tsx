// /decision-engine — AI Decision Observatory (Phase 22 §7).

import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { RegimeBadge } from "@/components/narrative";
import { DecisionList } from "@/components/decision/DecisionList";
import { AgentEnsemblePanel, type AgentProposal } from "@/components/decision/AgentEnsemblePanel";

export const metadata = { title: "Decision Engine · Atlas" };

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
  { id: "vol_spike",   severity: 8_100, target: "all assets", text: "30d realised vol breached the regime threshold." },
  { id: "drift_apy",   severity: 4_400, target: "drift kSOL", text: "Drift kSOL APY decayed 220 bps over 14d." },
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

const FEATURED_HASH = "a1b2c3d4" + "0".repeat(56);
const EXPLANATION_HASH = "9081a2b3" + "f".repeat(56);

export default function Page() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          ai decision observatory · public · zero auth
        </p>
        <h1 className="text-display text-[40px] leading-[48px] mt-2">
          Why Atlas moved capital, in three views.
        </h1>
        <p className="mt-3 text-[14px] text-[color:var(--color-ink-secondary)] max-w-[760px]">
          Every rebalance carries a structured explanation, an agent
          ensemble trace, and a CPI trace. The structured fields commit;
          the prose renders. Below is a featured defensive-mode rebalance —
          the same drilldown is available for every rebalance via the
          list.
        </p>
      </header>

      <Panel surface="raised" density="default" accent="warn">
        <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <RegimeBadge regime="defensive" />
            <AlertPill severity="warn">defensive mode</AlertPill>
            <AlertPill severity="danger">tail-risk hard veto</AlertPill>
            <span className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
              slot 245_002_400
            </span>
          </div>
          <IdentifierMono value={FEATURED_HASH} copy size="sm" />
        </header>

        <section className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">
            why · structured drivers
          </p>
          <ul className="space-y-3">
            {FEATURED_DRIVERS.map((d) => (
              <li
                key={d.id}
                className="grid grid-cols-12 gap-3 items-center border-t border-[color:var(--color-line-soft)] pt-3 first:border-0 first:pt-0"
              >
                <span className="col-span-2 font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
                  {d.id}
                </span>
                <div className="col-span-3">
                  <div className="h-1.5 rounded-[var(--radius-xs)] overflow-hidden bg-[color:var(--color-line-medium)]">
                    <div
                      className={`h-full ${d.severity >= 7000 ? "bg-[color:var(--color-accent-danger)]" : d.severity >= 4000 ? "bg-[color:var(--color-accent-warn)]" : "bg-[color:var(--color-accent-execute)]"}`}
                      style={{ width: `${d.severity / 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)] mt-1 block">
                    severity {d.severity}
                  </span>
                </div>
                <span className="col-span-2 font-mono text-[11px] text-[color:var(--color-ink-secondary)]">
                  {d.target}
                </span>
                <span className="col-span-5 text-[12px] text-[color:var(--color-ink-secondary)]">
                  {d.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            explanation_hash · poseidon over canonical bytes ·{" "}
            <IdentifierMono value={EXPLANATION_HASH} size="xs" />
            <span className="ml-2 italic">rendering, not commitment</span>
          </p>
        </section>

        <section className="mb-6">
          <AgentEnsemblePanel
            proposals={FEATURED_PROPOSALS}
            consensus_disagreement_bps={2_140}
          />
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] mb-2">
            how · cpi trace
          </p>
          <ol className="font-mono text-[11px] text-[color:var(--color-ink-secondary)] space-y-1">
            {FEATURED_CPI_TRACE.map((step) => (
              <li
                key={step.ix}
                className="grid grid-cols-12 gap-3 border-t border-[color:var(--color-line-soft)] pt-1.5 first:border-0 first:pt-0"
              >
                <span className="col-span-1 text-[color:var(--color-ink-tertiary)]">
                  {String(step.ix).padStart(2, "0")}
                </span>
                <span className="col-span-3 text-[color:var(--color-ink-primary)]">
                  {step.program}
                </span>
                <span className="col-span-8 text-[color:var(--color-ink-tertiary)]">
                  {step.call}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </Panel>

      <section>
        <header className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            recent decisions · filter by regime / veto
          </p>
        </header>
        <DecisionList />
      </section>
    </div>
  );
}

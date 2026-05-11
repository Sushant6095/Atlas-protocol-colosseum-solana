"use client";

// /decision-engine — engineering-blog-tier depth below the React Flow
// canvas. Seven sections, top → bottom:
//   01 how it works   · 3-stage architecture strip
//   02 the 7 agents   · 10 deep-dive cards (6 sensor / 3 decider / 1 executor)
//   03 the 3 gates    · sequential refusal flow
//   04 the proof      · SP1 public input shape + verifier metrics
//   05 invariants     · 26 hard rules grouped into 6 accordions
//   06 adversarial    · CI test corpus with PASS counts
//   07 the code       · direct crate / program links on GitHub
//
// Brand tokens only — no new deps. Uses lucide icons (already in deps
// from the mega-menu PR) and shadcn Accordion.

import Link from "next/link";
import {
  ArrowUpRight,
  Radio, Gauge, Coins, ShieldAlert, Droplet, AlertTriangle,
  GitMerge, Scale, Shield, Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const GH = "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana";

// ── Section 1 — how it works ──────────────────────────────────────

const STAGES = [
  {
    kind: "stage 01",
    title: "Sensors",
    body: "Six agents read oracles + alt data every 4s. Each is sandboxed, with strict latency budgets.",
    agents: [
      "Oracle (Pyth, Switchboard)",
      "Exposure (per-protocol caps)",
      "Fee (priority fee oracle)",
      "MEV (sandwich detection)",
      "Liquidity (slippage scout)",
      "Anomaly (cross-feed liar detection)",
    ],
  },
  {
    kind: "stage 02",
    title: "Deciders",
    body: "Three voting agents synthesize the sensor outputs into a rebalance plan or a refusal.",
    agents: [
      "Aggregator (vote merger)",
      "Policy Gate (invariant check)",
      "Trigger Gate (3-gate final)",
    ],
  },
  {
    kind: "stage 03",
    title: "Executor",
    body: "One agent emits the final tx. The plan becomes a Groth16 receipt before any vault state moves.",
    agents: ["Rebalancer (SP1 → Solana)"],
  },
];

// ── Section 2 — the 7 agents (10 cards: 6 sensor / 3 decider / 1 executor) ─

interface AgentCardData {
  id: string;
  icon: LucideIcon;
  title: string;
  loc: number;
  crate: string;
  accent: string;
  role: "sensor" | "decider" | "executor";
  bullets: [string, string, string];
}

const AGENT_DEEPDIVE: AgentCardData[] = [
  { id: "oracle",       icon: Radio,         title: "Oracle",       loc: 412,  crate: "atlas-pyth-post",     accent: "#3F8CFF", role: "sensor",   bullets: ["Pyth pull-oracle posting on-demand", "Switchboard fallback at slot-drift threshold", "Cross-feed median + outlier reject"] },
  { id: "exposure",     icon: Gauge,         title: "Exposure",     loc: 655,  crate: "atlas-exposure",      accent: "#3F8CFF", role: "sensor",   bullets: ["Per-protocol caps in bps (Kamino/Drift/Jupiter)", "Treasury entity exposure ledger", "Hard refusal above policy ceiling"] },
  { id: "fee",          icon: Coins,         title: "Fee Oracle",   loc: 187,  crate: "atlas-fee-oracle",    accent: "#3F8CFF", role: "sensor",   bullets: ["Priority fee floor from recent slots", "Compute unit budget per ix", "Refuse rebalance if cost > expected gain"] },
  { id: "mev",          icon: ShieldAlert,   title: "MEV",          loc: 240,  crate: "atlas-mev",           accent: "#3F8CFF", role: "sensor",   bullets: ["Sandwich detection from slot context", "JIT-liquidity pattern recognition", "Routes via Jito bundle if risk > threshold"] },
  { id: "liquidity",    icon: Droplet,       title: "Liquidity",    loc: 1237, crate: "atlas-rpc-router",    accent: "#3F8CFF", role: "sensor",   bullets: ["Pool depth check via Jupiter Quote", "Slippage budget enforced pre-execute", "Tier-A RPC failover (Helius, Triton)"] },
  { id: "anomaly",      icon: AlertTriangle, title: "Anomaly",      loc: 650,  crate: "atlas-lie",           accent: "#FF6166", role: "sensor",   bullets: ["Cross-validates oracle feeds", "Detects feed-divergence > 25 bps", "Triggers refusal path — withdrawals still flow"] },
  { id: "aggregator",   icon: GitMerge,      title: "Aggregator",   loc: 1538, crate: "atlas-intelligence",  accent: "#A682FF", role: "decider",  bullets: ["Merges 6 sensor votes", "Confidence-weighted by agent latency", "Outputs draft rebalance plan + reasoning trace"] },
  { id: "policygate",   icon: Scale,         title: "Policy Gate",  loc: 680,  crate: "atlas-trigger-gate",  accent: "#A682FF", role: "decider",  bullets: ["Strategy commitment hash check", "Allocation must match registered strategy", "Refuses if any I-1..I-26 invariant violated"] },
  { id: "triggergate",  icon: Shield,        title: "Trigger Gate", loc: 680,  crate: "atlas-trigger-gate",  accent: "#A682FF", role: "decider",  bullets: ["3-gate final: freshness · oracle · exposure", "Last veto before SP1 prover runs", "Refusal logged to atlas-bus for forensics"] },
  { id: "rebalancer",   icon: Zap,           title: "Rebalancer",   loc: 1711, crate: "atlas-operator-agent", accent: "#3CE39A", role: "executor", bullets: ["Builds versioned tx with scoped keys", "Submits via atlas-presign + Jito bundle", "Waits for atlas_verifier CPI → atlas_vault commit"] },
];

// ── Section 3 — the 3 gates ────────────────────────────────────────

const GATES = [
  { name: "Freshness", color: "#3F8CFF", body: "Slot drift between Atlas's last proof and current Solana slot must stay within the freshness budget. Stale state cannot rebalance.",                       refuseHint: "REFUSE if drift > 400 slots" },
  { name: "Oracle",    color: "#A682FF", body: "Pyth + Switchboard feeds must agree within 25 bps. Cross-feed liar detection runs at every tick.",                                                          refuseHint: "REFUSE if median spread > 25 bps" },
  { name: "Exposure",  color: "#F478C6", body: "Proposed allocation cannot exceed per-protocol exposure cap (Kamino ≤ 40%, Drift ≤ 30%, Jupiter ≤ 30%). Caps live in the registered strategy.",            refuseHint: "REFUSE if any leg > strategy cap" },
];

// ── Section 5 — invariants ─────────────────────────────────────────

interface Invariant { id: string; text: string; }
interface InvariantGroup { id: string; title: string; invariants: Invariant[]; }

const INVARIANT_GROUPS: InvariantGroup[] = [
  { id: "trust", title: "Trust rules", invariants: [
    { id: "I-7",  text: "No proof, no state move. Every state transition requires a Groth16 receipt verified on-chain." },
    { id: "I-11", text: "Withdrawals are never proof-gated. Users always exit, even when the prover is down or refusing." },
    { id: "I-14", text: "No admin key after launch. Squads multisig holds upgrade authority — not a single EOA." },
    { id: "I-26", text: "Demo discipline. No fake on-chain state surfaced as live." },
  ]},
  { id: "strategy", title: "Strategy + allocation", invariants: [
    { id: "I-1",  text: "Strategy commitment is immutable post-creation." },
    { id: "I-2",  text: "Allocation must match the registered strategy hash bit-for-bit." },
    { id: "I-3",  text: "Per-protocol exposure caps enforced in bps." },
    { id: "I-4",  text: "Idle buffer floor per template (Treasury Defense ≥ 50%)." },
    { id: "I-5",  text: "Rebalance plan total = 10,000 bps. Round-trip drift rejected." },
  ]},
  { id: "freshness", title: "Freshness + replay", invariants: [
    { id: "I-6",  text: "Slot drift must stay within freshness budget (default 400 slots)." },
    { id: "I-8",  text: "Stale proofs rejected — slot field validated against current_slot." },
    { id: "I-22", text: "Intent dedup by (treasury_id, intent_id) across 24h window." },
    { id: "I-23", text: "Webhook replay window 10 minutes — anything older drops silently." },
  ]},
  { id: "privacy", title: "Confidentiality + disclosure", invariants: [
    { id: "I-16", text: "Confidential-pattern (Pattern A Token-2022 / Pattern B Cloak) is immutable per vault." },
    { id: "I-17", text: "Every disclosure event logged to Bubblegum compressed merkle." },
    { id: "I-18", text: "Viewing keys are scoped + revocable. No unlimited audit keys." },
    { id: "I-19", text: "AML clearance attestation required for above-threshold flows." },
  ]},
  { id: "execute", title: "Execution + CPI safety", invariants: [
    { id: "I-9",  text: "CPI targets verified against allowlist (atlas-cpi-guard)." },
    { id: "I-10", text: "Pre-signed tx pool clears every 60s — no stale plans land." },
    { id: "I-12", text: "Bundle composition (Jito) — rebalance is atomic or full-revert." },
    { id: "I-13", text: "MEV-protected routes preferred when sandwich risk > threshold." },
  ]},
  { id: "telemetry", title: "Telemetry + governance", invariants: [
    { id: "I-15", text: "All agent outputs published to atlas-bus for forensic replay." },
    { id: "I-20", text: "Governance proposal required for strategy registry mutation." },
    { id: "I-21", text: "PUSD-specific telemetry: 6 metrics shipped, drift CI." },
    { id: "I-24", text: "Token-2022 extension drift caught by atlas-drift-check binary." },
    { id: "I-25", text: "Pause is a multisig-only operation; no programmatic kill switch." },
  ]},
];

// ── Section 6 — adversarial corpus ─────────────────────────────────

const TESTS = [
  { scenario: "Pyth feed jump > 100 bps",     expected: "REFUSE",             count: 48 },
  { scenario: "Slot drift > 400",             expected: "REFUSE",             count: 24 },
  { scenario: "Strategy hash mismatch",       expected: "REFUSE",             count: 12 },
  { scenario: "Replay of stale proof",        expected: "REFUSE",             count: 36 },
  { scenario: "Exposure cap exceeded",        expected: "REFUSE",             count: 18 },
  { scenario: "MEV sandwich pattern",         expected: "REROUTE",            count: 22 },
  { scenario: "Prover offline 5min",          expected: "WITHDRAW STILL OK",  count: 15 },
  { scenario: "Dodo webhook replay",          expected: "DEDUP-REJECT",       count: 10 },
];

// ── Section 7 — code references ────────────────────────────────────

const CODE_LINKS = [
  { path: "crates/atlas-intelligence",    desc: "decision engine + 7-agent vote merger",        href: `${GH}/tree/main/crates/atlas-intelligence` },
  { path: "crates/atlas-operator-agent",  desc: "keeper logic + scoped key signing",            href: `${GH}/tree/main/crates/atlas-operator-agent` },
  { path: "crates/atlas-trigger-gate",    desc: "3-gate refusal engine",                         href: `${GH}/tree/main/crates/atlas-trigger-gate` },
  { path: "crates/atlas-lie",             desc: "cross-feed oracle liar detection",              href: `${GH}/tree/main/crates/atlas-lie` },
  { path: "prover/zkvm-program",          desc: "SP1 RISC-V program proving the decision",       href: `${GH}/tree/main/prover/zkvm-program` },
  { path: "programs/atlas-verifier",      desc: "Groth16 on-chain verifier (sp1-solana)",        href: `${GH}/tree/main/programs/atlas-verifier` },
  { path: "programs/atlas-rebalancer",    desc: "3-gate CPI-verifier-then-vault state machine",  href: `${GH}/tree/main/programs/atlas-rebalancer` },
  { path: "programs/atlas-vault",         desc: "deposit · withdraw · share accounting",         href: `${GH}/tree/main/programs/atlas-vault` },
];

// ─────────────────────────────────────────────────────────────────

export function DecisionEngineDepth(): JSX.Element {
  return (
    <div className="text-[color:var(--color-ink-primary)]">
      <SectionHowItWorks />
      <SectionAgents />
      <SectionGates />
      <SectionProof />
      <SectionInvariants />
      <SectionAdversarial />
      <SectionCodeRefs />
    </div>
  );
}

// ─── 01 — How it works ────────────────────────────────────────────

function SectionHowItWorks(): JSX.Element {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-6">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent-electric)]">
        01 · architecture
      </p>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.02em]">
        Three stages.{" "}
        <span className="text-[color:var(--color-ink-tertiary)]">No trust assumptions.</span>
      </h2>
      <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[color:var(--color-ink-secondary)]">
        The decision engine runs every{" "}
        <span className="font-semibold text-[color:var(--color-accent-electric)]">4 seconds</span>.
        Six sensor agents fetch data, three decider agents vote, and the rebalancer
        executor produces a plan. The plan is never trusted by Atlas's on-chain
        programs — it is{" "}
        <span className="font-semibold text-[color:var(--color-accent-zk)]">proven via SP1 zkVM</span>{" "}
        before any state moves.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STAGES.map((stage) => (
          <div
            key={stage.kind}
            className="rounded-2xl border border-white/[0.08] bg-[color:var(--color-surface-raised)]/40 p-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--color-ink-tertiary)]">
              {stage.kind}
            </p>
            <h3 className="mt-2 font-display text-xl">{stage.title}</h3>
            <p className="mt-3 text-[13.5px] leading-snug text-[color:var(--color-ink-tertiary)]">
              {stage.body}
            </p>
            <ul className="mt-4 space-y-1">
              {stage.agents.map((a) => (
                <li key={a} className="font-mono text-[12px] text-[color:var(--color-ink-secondary)]">
                  · {a}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 02 — Agents deep dive ────────────────────────────────────────

function SectionAgents(): JSX.Element {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-6">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent-zk)]">
        02 · the agents
      </p>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.02em]">
        Seven agents.{" "}
        <span className="text-[color:var(--color-ink-tertiary)]">One vote. One proof.</span>
      </h2>
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {AGENT_DEEPDIVE.map((a) => (
          <AgentCard key={a.id} data={a} />
        ))}
      </div>
    </section>
  );
}

function AgentCard({ data }: { data: AgentCardData }): JSX.Element {
  const Icon = data.icon;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[color:var(--color-surface-raised)]/30 p-5 transition-colors hover:bg-[color:var(--color-surface-raised)]/50">
      <div className="flex items-center justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${data.accent}14`,
            color: data.accent,
            boxShadow: `inset 0 0 0 1px ${data.accent}33`,
          }}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]">
          {data.role}
        </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{data.title}</h3>
      <ul className="mt-3 space-y-1.5 text-[12.5px] text-[color:var(--color-ink-secondary)]">
        {data.bullets.map((b, i) => <li key={i}>· {b}</li>)}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
        <code className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">{data.crate}</code>
        <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">{data.loc} LOC</span>
      </div>
    </div>
  );
}

// ─── 03 — Gates ──────────────────────────────────────────────────

function SectionGates(): JSX.Element {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-6">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent-proof)]">
        03 · the gates
      </p>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.02em]">
        Three gates.{" "}
        <span className="text-[color:var(--color-ink-tertiary)]">Any veto refuses the rebalance.</span>
      </h2>
      <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[color:var(--color-ink-secondary)]">
        Before SP1 generates a proof, three sequential gates must all pass.
        Any one of them returning{" "}
        <span className="text-[color:var(--color-accent-danger)]">REFUSE</span>{" "}
        aborts the rebalance entirely. Withdrawals remain unblocked under invariant I-11.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {GATES.map((g, i) => (
          <div
            key={g.name}
            className="relative rounded-2xl border p-6"
            style={{ borderColor: `${g.color}33`, backgroundColor: `${g.color}08` }}
          >
            <span
              className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: g.color }}
            >
              gate {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-display text-xl">{g.name}</h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[color:var(--color-ink-secondary)]">
              {g.body}
            </p>
            <p className="mt-4 font-mono text-[11px]" style={{ color: g.color }}>
              {g.refuseHint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 04 — Proof ──────────────────────────────────────────────────

function SectionProof(): JSX.Element {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-6">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent-execute)]">
        04 · the proof
      </p>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.02em]">
        Every rebalance is a Groth16 receipt.
      </h2>
      <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[color:var(--color-ink-secondary)]">
        The decision plan becomes the{" "}
        <span className="font-semibold text-[color:var(--color-accent-execute)]">public input</span>{" "}
        to an SP1 zkVM program. The prover proves: given these sensor votes, the policy gate
        would have passed. The proof is verified on-chain by{" "}
        <code className="font-mono text-[13px] text-[color:var(--color-accent-execute)]">atlas_verifier</code>{" "}
        before atlas_rebalancer is allowed to touch atlas_vault state.
      </p>

      <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[color:var(--color-surface-raised)]/30 p-6">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]">
          public_input_v3.rs — 300 bytes
        </p>
        <pre className="overflow-x-auto font-mono text-[12.5px] leading-6 text-[color:var(--color-ink-secondary)]">
{`pub struct PublicInputV3 {
  pub vault_id:            [u8; 32],   // PDA of target vault
  pub strategy_hash:       [u8; 32],   // committed strategy
  pub allocation:          Allocation, // proposed split
  pub slot:                u64,        // proof slot
  pub timestamp:           i64,        // wall-clock
  pub commitment:          [u8; 32],   // Pedersen of (idle, deployed)
  pub disclosure_policy:   [u8; 32],   // confidential-mode hash
  pub confidential_mode:   u8,         // pattern A or B
  pub agent_votes:         [Vote; 7],  // sensor + decider results
  pub gate_results:        [Gate; 3],  // 3-gate verdicts
}`}
        </pre>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ProofMetric label="proof size"       value="~280 bytes" />
        <ProofMetric label="verifier compute" value="~200k CU" />
        <ProofMetric label="verifier program" value="A738nTHZK…ufR1" mono />
      </div>
    </section>
  );
}

function ProofMetric({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[color:var(--color-surface-raised)]/20 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]">
        {label}
      </p>
      <p className={`mt-2 ${mono ? "font-mono text-[12px]" : "font-display text-xl"}`}>{value}</p>
    </div>
  );
}

// ─── 05 — Invariants accordion ──────────────────────────────────

function SectionInvariants(): JSX.Element {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-6">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent-warn)]">
        05 · invariants
      </p>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.02em]">
        26 hard rules.{" "}
        <span className="text-[color:var(--color-ink-tertiary)]">Enforced in CI.</span>
      </h2>

      <Accordion type="multiple" className="mt-10 space-y-2">
        {INVARIANT_GROUPS.map((g) => (
          <AccordionItem
            key={g.id}
            value={g.id}
            className="rounded-xl border border-white/[0.08] bg-[color:var(--color-surface-raised)]/20 px-4"
          >
            <AccordionTrigger className="font-display text-base">
              <span className="flex w-full items-center">
                {g.title}
                <span className="ml-auto mr-3 font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
                  {g.invariants.length} rules
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pb-4">
                {g.invariants.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-start gap-3 text-[13.5px] text-[color:var(--color-ink-secondary)]"
                  >
                    <code className="mt-0.5 shrink-0 font-mono text-[12px] text-[color:var(--color-accent-electric)]">
                      {inv.id}
                    </code>
                    <span>{inv.text}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

// ─── 06 — Adversarial corpus ────────────────────────────────────

function SectionAdversarial(): JSX.Element {
  return (
    <section className="mx-auto mt-24 max-w-6xl px-6">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent-danger)]">
        06 · adversarial
      </p>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.02em]">
        We try to break it before you do.
      </h2>
      <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[color:var(--color-ink-secondary)]">
        atlas-chaos and atlas-replay run an adversarial test corpus on every CI build.
        The decision engine must produce{" "}
        <span className="font-semibold text-[color:var(--color-accent-execute)]">REFUSE</span>{" "}
        on every malicious input, and withdrawals must succeed even under prover failure.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TESTS.map((t) => (
          <div
            key={t.scenario}
            className="rounded-xl border border-white/[0.08] bg-[color:var(--color-surface-raised)]/20 p-4"
          >
            <p className="text-[12px] leading-snug text-[color:var(--color-ink-secondary)]">
              {t.scenario}
            </p>
            <p className="mt-3 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">expects:</p>
            <p className="font-mono text-[11px] text-[color:var(--color-accent-warn)]">{t.expected}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-accent-execute)]/15 px-2 py-0.5">
                <span className="size-1.5 rounded-full bg-[color:var(--color-accent-execute)]" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-accent-execute)]">
                  pass
                </span>
              </span>
              <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                {t.count} cases
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 07 — Code refs ─────────────────────────────────────────────

function SectionCodeRefs(): JSX.Element {
  return (
    <section className="mx-auto mb-32 mt-24 max-w-6xl px-6">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-accent-electric)]">
        07 · the code
      </p>
      <h2 className="mt-4 font-display text-4xl font-medium tracking-[-0.02em]">
        Read the source.
      </h2>
      <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[color:var(--color-ink-secondary)]">
        All crates above ship in the open. ~43,000 LOC across 46 Rust crates.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
        {CODE_LINKS.map((link) => (
          <Link
            key={link.path}
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="group flex items-center justify-between rounded-xl border border-white/[0.08] bg-[color:var(--color-surface-raised)]/20 px-5 py-4 transition-colors hover:bg-[color:var(--color-surface-raised)]/40"
          >
            <div>
              <code className="font-mono text-[13px]">{link.path}</code>
              <p className="mt-1 text-[12px] text-[color:var(--color-ink-tertiary)]">{link.desc}</p>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-[color:var(--color-ink-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}

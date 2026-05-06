// Atlas landing page (Phase 22 §1).
//
// Composition (top → bottom):
//   1. hero        — headline + CTAs + lattice + live counters
//   2. proof       — 8-stage proof lifecycle visualisation
//   3. trust       — invariants / determinism / replay / adversarial
//   4. live        — live rebalance feed (WS-backed)
//   5. protocols   — integrated protocols
//   6. architecture— teaser + link to /architecture
//   7. api         — developer platform teaser
//   8. cta         — connect wallet
//
// Every numeric token here resolves through `lib/tokens.ts` via CSS
// variables; no raw hex anywhere.

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, ShieldCheck, Layers } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Panel } from "@/components/primitives/Panel";
import {
  HeroLattice,
  LiveCounter,
  LiveRebalanceFeed,
  ProofLifecycle,
} from "@/components/narrative";
import { transitions, heroLift, fadeIn } from "@/lib/motion";

export default function LandingPage() {
  return (
    <>
      {/* ── 1. hero ─────────────────────────────────────────────── */}
      <section className="relative px-20 pt-24 pb-32 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7">
            <motion.h1
              initial="hidden" animate="visible" variants={heroLift}
              className="text-display text-[80px] leading-[88px] tracking-tight max-w-[820px]"
            >
              Autonomous treasury infrastructure
              <br />
              for stablecoin capital on Solana.
            </motion.h1>
            <motion.p
              initial="hidden" animate="visible" variants={fadeIn}
              transition={{ delay: 0.12 }}
              className="mt-6 text-[16px] leading-[22px] text-[color:var(--color-ink-secondary)] max-w-[640px]"
            >
              AI-managed allocations. zk-verified rebalances. Public proof
              of every movement.
            </motion.p>
            <motion.div
              initial="hidden" animate="visible" variants={fadeIn}
              transition={{ delay: 0.18 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              <Link href="/vaults">
                <Button variant="primary" size="lg">
                  Open Atlas
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/architecture">
                <Button variant="secondary" size="lg">
                  Read the architecture
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial="hidden" animate="visible" variants={fadeIn}
              transition={{ delay: 0.24 }}
              className="mt-12 grid grid-cols-3 gap-6 max-w-[520px]"
            >
              <LiveCounter
                value={undefined /* wired in Phase 22 telemetry slice */}
                label="proofs · 24h"
                hint="onchain · verified"
              />
              <LiveCounter
                value={undefined}
                label="tvl managed"
                hint="across vaults"
                format={(n) => `$${(n / 1_000_000).toFixed(1)}M`}
              />
              <LiveCounter
                value={undefined}
                label="last rebalance"
                hint="seconds ago"
              />
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1, transition: transitions.cinemaHero }}
            className="lg:col-span-5"
          >
            <HeroLattice />
          </motion.div>
        </div>
      </section>

      {/* ── 2. proof lifecycle ──────────────────────────────────── */}
      <section className="px-20 py-24 max-w-[1440px] mx-auto">
        <header className="mb-12 max-w-[640px]">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            proof lifecycle
          </p>
          <h2 className="text-display text-[40px] leading-[48px] mt-2">
            Eight stages. Every one verifiable.
          </h2>
          <p className="mt-3 text-[14px] text-[color:var(--color-ink-secondary)]">
            From quorum ingestion to mainnet settlement, each stage carries an
            SLO and a public-input commitment. Click any stage on
            <Link href="/architecture" className="text-[color:var(--color-accent-electric)] hover:underline"> /architecture</Link>{" "}
            for the file-level walkthrough.
          </p>
        </header>
        <Panel surface="raised" density="default">
          <ProofLifecycle />
        </Panel>
      </section>

      {/* ── 3. trust ────────────────────────────────────────────── */}
      <section className="px-20 py-24 max-w-[1440px] mx-auto">
        <header className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            trust posture
          </p>
          <h2 className="text-display text-[40px] leading-[48px] mt-2">
            Atlas does not require trust. It is structurally checkable.
          </h2>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_COLUMNS.map((col) => (
            <Panel key={col.title} surface="raised" density="default">
              <div className="flex items-center gap-2 mb-4">
                <col.icon className="h-4 w-4 text-[color:var(--color-accent-electric)]" />
                <h3 className="text-display text-[20px]">{col.title}</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {col.invariants.map((inv) => (
                  <li key={inv.id}>
                    <p className="font-mono text-[11px] text-[color:var(--color-accent-zk)]">
                      {inv.id}
                    </p>
                    <p className="text-[13px] text-[color:var(--color-ink-secondary)]">
                      {inv.text}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </section>

      {/* ── 4. live rebalance feed ──────────────────────────────── */}
      <section className="px-20 py-24 max-w-[1440px] mx-auto">
        <header className="mb-8 flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              live · public stream
            </p>
            <h2 className="text-display text-[40px] leading-[48px] mt-2">
              Every move, visible.
            </h2>
          </div>
          <Link
            href="/proofs/live"
            className="text-[13px] text-[color:var(--color-accent-electric)] hover:underline"
          >
            open proof explorer →
          </Link>
        </header>
        <LiveRebalanceFeed limit={10} />
      </section>

      {/* ── 5. protocols ────────────────────────────────────────── */}
      <section className="px-20 py-24 max-w-[1440px] mx-auto">
        <header className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            integrated protocols
          </p>
          <h2 className="text-display text-[40px] leading-[48px] mt-2">
            Routes through every major Solana yield surface.
          </h2>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Kamino", "Drift", "Marginfi", "Jupiter"].map((p) => (
            <Panel key={p} surface="raised" density="dense" className="text-center">
              <p className="text-display text-[20px]">{p}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                CPI allowlisted
              </p>
            </Panel>
          ))}
        </div>
      </section>

      {/* ── 6. architecture teaser ─────────────────────────────── */}
      <section className="px-20 py-24 max-w-[1440px] mx-auto">
        <Panel surface="raised" density="cinematic">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            architecture
          </p>
          <h2 className="text-display text-[40px] leading-[48px] mt-2 max-w-[640px]">
            Capital, models, proofs, settlement, and disclosure each live in their own layer.
          </h2>
          <p className="mt-4 max-w-[640px] text-[14px] text-[color:var(--color-ink-secondary)]">
            Open the live blueprint. Hover any node for the file-level
            entry point. Click "play story" to walk through one rebalance
            from ingestion to settlement.
          </p>
          <div className="mt-8">
            <Link href="/architecture">
              <Button variant="secondary" size="md">
                Open the diagram
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </Panel>
      </section>

      {/* ── 7. developer platform ───────────────────────────────── */}
      <section className="px-20 py-24 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel surface="raised" density="default">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              developer platform
            </p>
            <h3 className="text-display text-[28px] mt-2">
              45 endpoints. 2 streams. Two SDKs.
            </h3>
            <p className="mt-3 text-[13px] text-[color:var(--color-ink-secondary)]">
              <code className="text-mono">@atlas/sdk</code>,
              <code className="text-mono"> @atlas/widgets</code>,
              <code className="text-mono"> @atlas/qvac</code>, and{" "}
              <code className="text-mono">atlas-rs</code> consume the same
              REST + WS contract Atlas does internally.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link href="/docs"><Button variant="primary" size="sm">Open docs</Button></Link>
              <Link href="/playground"><Button variant="ghost" size="sm">Playground</Button></Link>
            </div>
          </Panel>
          <Panel surface="raised" density="default">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              public observatory
            </p>
            <h3 className="text-display text-[28px] mt-2">
              Plumbing as a public surface.
            </h3>
            <p className="mt-3 text-[13px] text-[color:var(--color-ink-secondary)]">
              Twelve panels. Live RPC latency, slot drift attribution,
              proof gen, validator health, freshness budget. Zero auth.
            </p>
            <div className="mt-6">
              <Link href="/infra"><Button variant="primary" size="sm">Open /infra</Button></Link>
            </div>
          </Panel>
        </div>
      </section>

      {/* ── 8. CTA ──────────────────────────────────────────────── */}
      <section className="px-20 py-32 max-w-[1440px] mx-auto text-center">
        <h2 className="text-display text-[56px] leading-[64px] tracking-tight">
          Connect a wallet. Read the proof. Decide.
        </h2>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/vaults"><Button variant="primary" size="lg">Open Atlas</Button></Link>
          <Link href="/proofs/live"><Button variant="secondary" size="lg">Verify in browser</Button></Link>
        </div>
      </section>
    </>
  );
}

const TRUST_COLUMNS = [
  {
    title: "Determinism",
    icon: Cpu,
    invariants: [
      { id: "I-1", text: "Strategy is committed at vault creation; no mid-life flip." },
      { id: "I-3", text: "Proofs older than MAX_STALE_SLOTS rejected on-chain." },
      { id: "I-4", text: "Public input layout is fixed-size; no Borsh on the verifier path." },
    ],
  },
  {
    title: "Replay",
    icon: Layers,
    invariants: [
      { id: "I-5", text: "Every rebalance reproduces from the warehouse byte-for-byte." },
      { id: "I-7", text: "Bus events are content-addressed via blake3." },
      { id: "I-8", text: "Archival writes are atomic with rebalance commits." },
    ],
  },
  {
    title: "Adversarial Survival",
    icon: ShieldCheck,
    invariants: [
      { id: "I-18", text: "Cross-role keeper signing rejected at the program ix entry." },
      { id: "I-20", text: "High-impact actions need an attestation from a distinct signer + RPC quorum." },
      { id: "I-23", text: "Verifier accepts only ER-rooted post-states inside private execution." },
    ],
  },
] as const;

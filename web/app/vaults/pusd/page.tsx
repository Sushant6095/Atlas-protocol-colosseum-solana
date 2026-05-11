"use client";

// /vaults/pusd — dedicated PUSD-native detail page.
//
// Lives outside the dynamic [symbol] route because PUSD is a category
// of 12 vault recipes, not a single recipe. Hosts the recipe matrix,
// Token-2022 extension manifest, and the Dodo → Atlas pre-warm
// simulation (judges click "Simulate Dodo invoice incoming" and watch
// the buffer ratchet up across 3 ticks with sp1 receipt links per
// tick — single feature, two side-track demos).

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Zap,
  Check,
  FileCheck,
  Activity,
} from "lucide-react";
import { BorderBeam } from "@/components/magicui/border-beam";
import { Footer } from "@/components/Footer";

const PUSD = "#A682FF";
const GITHUB_PUSD_RS =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/crates/atlas-assets/src/pusd.rs";

interface Recipe {
  family: string;
  body: string;
  bands: { name: "Low" | "Mid" | "Hot"; apy: string }[];
}

const RECIPES: Recipe[] = [
  {
    family: "PusdSafeYield",
    body: "All-PUSD lending split. Drift insurance, Kamino main, MarginFi.",
    bands: [
      { name: "Low", apy: "4.80%" },
      { name: "Mid", apy: "6.20%" },
      { name: "Hot", apy: "7.95%" },
    ],
  },
  {
    family: "PusdYieldBalanced",
    body: "PUSD lending + concentrated PUSD-USDC LP fee capture.",
    bands: [
      { name: "Low", apy: "5.60%" },
      { name: "Mid", apy: "8.40%" },
      { name: "Hot", apy: "11.10%" },
    ],
  },
  {
    family: "PusdTreasuryDefense",
    body: "Idle-heavy PUSD with funding-shorts on perps. Hedged drift.",
    bands: [
      { name: "Low", apy: "3.20%" },
      { name: "Mid", apy: "5.50%" },
      { name: "Hot", apy: "8.10%" },
    ],
  },
  {
    family: "PusdJupiterLend",
    body: "PUSD lent through Jupiter Lend with rebate co-routing.",
    bands: [
      { name: "Low", apy: "6.10%" },
      { name: "Mid", apy: "9.30%" },
      { name: "Hot", apy: "12.80%" },
    ],
  },
];

interface PreWarmTick {
  pct: number;
  label: string;
  receipt: string;
}

const TICKS: PreWarmTick[] = [
  { pct: 85, label: "tick 1 · pedersen commit", receipt: "0xa1f2…39c" },
  { pct: 93, label: "tick 2 · funding lock",    receipt: "0xb284…ef2" },
  { pct: 100,label: "tick 3 · settle ready",    receipt: "0xc7d1…018" },
];

export default function PusdVaultPage(): JSX.Element {
  const [pct, setPct] = useState(78);
  const [tickIdx, setTickIdx] = useState(-1);
  const [busy, setBusy] = useState(false);

  function simulate(): void {
    if (busy) return;
    setBusy(true);
    setPct(78);
    setTickIdx(-1);

    TICKS.forEach((t, i) => {
      setTimeout(() => {
        setPct(t.pct);
        setTickIdx(i);
        if (i === TICKS.length - 1) {
          setTimeout(() => {
            setBusy(false);
            setPct(78);
            setTickIdx(-1);
          }, 5000);
        }
      }, (i + 1) * 850);
    });
  }

  return (
    <main>
      {/* hero */}
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/vaults"
            className="font-mono text-[10px] uppercase tracking-[0.18em] hover:opacity-80"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            ← /vaults
          </Link>
          <span
            className="ml-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{
              borderColor: `color-mix(in oklab, ${PUSD} 45%, transparent)`,
              color: PUSD,
              background: `color-mix(in oklab, ${PUSD} 12%, transparent)`,
            }}
          >
            <Sparkles className="h-3 w-3" /> Primary reserve · PUSD-native
          </span>
        </div>

        <h1
          className="mt-4 font-display text-3xl font-semibold leading-[1.1] md:text-5xl"
          style={{ color: "var(--color-ink-primary)" }}
        >
          Atlas is <span style={{ color: PUSD }}>PUSD-native</span>.
        </h1>
        <p
          className="mt-3 max-w-2xl text-base leading-[1.55]"
          style={{ color: "var(--color-ink-secondary)" }}
        >
          Not <em className="not-italic opacity-70">"we also support PUSD"</em>.
          4 strategies × 3 risk bands = 12 vault recipes, every recipe
          denominated, settled, and rebalanced in PUSD with a Token-2022
          extension manifest and a hard <code>atlas-drift-check</code> CI gate.
        </p>
      </section>

      {/* pre-warm simulator */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div
          className="relative overflow-hidden rounded-[16px] border p-6 md:p-8"
          style={{
            borderColor: `color-mix(in oklab, ${PUSD} 30%, transparent)`,
            background: "var(--color-surface-raised)",
          }}
        >
          <BorderBeam size={260} duration={10} colorFrom={PUSD} colorTo="#3F8CFF" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                pusd pre-warm · dodo invoice path
              </p>
              <p className="mt-1 font-display text-xl font-semibold md:text-2xl">
                PUSD pre-warm: <span className="tabular-nums">{pct}%</span> → 100%
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-ink-secondary)" }}>
                Pedersen-style buffer commitment, 3 ticks. Each tick emits an sp1 receipt.
              </p>
            </div>

            <button
              onClick={simulate}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: PUSD, color: "var(--color-surface-base)" }}
            >
              {busy ? (
                <>
                  <Activity className="h-4 w-4 animate-pulse" /> Simulating…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" /> Simulate Dodo invoice incoming
                </>
              )}
            </button>
          </div>

          {/* progress bar */}
          <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ background: "var(--color-line-soft)" }}>
            <div
              className="h-full transition-[width] duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(to right, ${PUSD}, #3F8CFF)`,
              }}
            />
          </div>

          {/* tick receipts */}
          <ol className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-3">
            {TICKS.map((t, i) => {
              const active = tickIdx >= i;
              return (
                <li
                  key={t.label}
                  className="flex items-center justify-between rounded-md border px-3 py-2 transition-colors"
                  style={{
                    borderColor: active
                      ? `color-mix(in oklab, ${PUSD} 40%, transparent)`
                      : "var(--color-line-soft)",
                    background: active
                      ? `color-mix(in oklab, ${PUSD} 8%, transparent)`
                      : "transparent",
                  }}
                >
                  <div className="min-w-0">
                    <p
                      className="font-mono text-[10px] uppercase tracking-[0.16em]"
                      style={{ color: active ? PUSD : "var(--color-ink-tertiary)" }}
                    >
                      {t.label}
                    </p>
                    <p
                      className="mt-0.5 font-mono text-[11px]"
                      style={{ color: "var(--color-ink-secondary)" }}
                    >
                      sp1 receipt {t.receipt}
                    </p>
                  </div>
                  {active ? (
                    <Check className="h-4 w-4" style={{ color: PUSD }} />
                  ) : (
                    <span className="font-mono text-[10px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      —
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* recipe matrix */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--color-accent-zk)" }}
        >
          12 recipes · 4 strategy families × 3 risk bands
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold md:text-3xl">
          Recipe matrix
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {RECIPES.map((r) => (
            <div
              key={r.family}
              className="rounded-[12px] border p-5"
              style={{
                borderColor: "var(--color-line-soft)",
                background: "var(--color-surface-raised)",
              }}
            >
              <p className="font-display text-base font-semibold" style={{ color: "var(--color-ink-primary)" }}>
                {r.family}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                {r.body}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {r.bands.map((b) => (
                  <div
                    key={b.name}
                    className="rounded-md border px-3 py-2"
                    style={{
                      borderColor: "var(--color-line-soft)",
                      background: "var(--color-surface-base)",
                    }}
                  >
                    <p
                      className="font-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--color-ink-tertiary)" }}
                    >
                      {b.name}
                    </p>
                    <p
                      className="mt-0.5 font-mono text-sm font-semibold tabular-nums"
                      style={{ color: "var(--color-accent-execute)" }}
                    >
                      {b.apy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* declared hard rule */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div
          className="rounded-[12px] border p-5"
          style={{
            borderColor: `color-mix(in oklab, ${PUSD} 35%, transparent)`,
            background: `color-mix(in oklab, ${PUSD} 6%, var(--color-surface-raised))`,
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: PUSD }}>
            declared hard rule
          </p>
          <p className="mt-2 font-display text-lg font-semibold" style={{ color: "var(--color-ink-primary)" }}>
            no PUSD-native vault → no PUSD claim
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-secondary)" }}>
            A vault that holds PUSD as collateral but routes yield through
            non-PUSD venues is not a PUSD vault. The drift-check CI binary
            fails the build at the workspace level if any recipe's leg list
            references a non-PUSD pool more than 12 hours.
          </p>
        </div>
      </section>

      {/* trust + cta */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/docs/integrations/pusd"
            className="group rounded-[12px] border p-5 transition-colors hover:border-[color:var(--color-accent-zk)]"
            style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-raised)" }}
          >
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" style={{ color: PUSD }} />
              <p className="font-display text-sm font-semibold">PUSD integration doc</p>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--color-ink-secondary)" }}>
              Token-2022 manifest, 6 Prometheus metrics, drift-check binary, full press page.
            </p>
            <p className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: PUSD }}>
              read the doc <ArrowUpRight className="h-3 w-3" />
            </p>
          </Link>

          <a
            href={GITHUB_PUSD_RS}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-[12px] border p-5 transition-colors hover:border-[color:var(--color-accent-zk)]"
            style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-raised)" }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-accent-execute)" }} />
              <p className="font-display text-sm font-semibold">pusd.rs on GitHub</p>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--color-ink-secondary)" }}>
              Token-2022 extension manifest, allowed / forbidden lists, drift-check entry.
            </p>
            <p className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--color-accent-execute)" }}>
              crates/atlas-assets/src/pusd.rs <ArrowUpRight className="h-3 w-3" />
            </p>
          </a>

          <Link
            href="/treasury/demo/payments"
            className="group rounded-[12px] border p-5 transition-colors hover:border-[color:var(--color-accent-zk)]"
            style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-raised)" }}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "var(--color-accent-warn)" }} />
              <p className="font-display text-sm font-semibold">Dodo payments panel</p>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--color-ink-secondary)" }}>
              Live HMAC-signed webhook receipts and Simulate Dodo invoice button.
            </p>
            <p className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--color-accent-warn)" }}>
              open the panel <ArrowUpRight className="h-3 w-3" />
            </p>
          </Link>
        </div>

        <p
          className="mt-10 text-center font-display text-lg italic"
          style={{ color: "var(--color-ink-secondary)" }}
        >
          trust the math.
        </p>
      </section>

      <Footer />
    </main>
  );
}

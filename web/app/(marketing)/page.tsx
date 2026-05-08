// Atlas landing page — moment-1 anchored.
//
// Composition (top → bottom, every section laddering to one of the
// three demo moments named in the principal-engineer brief):
//
//   1. hero            — moment 1 (verify) front-and-center
//   2. proof lifecycle — moment 1 (the eight stages of a verifiable rebalance)
//   3. three products  — moment 2 + 3 (Protocol / Vault / Treasury OS)
//   4. trust posture   — invariants behind moment 3 (refusal + recovery)
//   5. live feed       — proof-anchored events from the network
//   6. architecture    — single-row timeline pill strip
//   7. cta footer      — connect wallet · open inspector · docs
//
// Hard rules from the brief enforced here:
//   - All-lowercase nav. Single accent (electric). No carousels.
//     No marquee. Display font for headlines, body for prose, mono
//     for every number.
//   - Hero is the only place a 3D scene runs (HeroLattice today;
//     BackgroundField r3f scene lands in Wave 4). Below the fold
//     is SVG / CSS only.
//   - Hero is NOT a viewport-filling gradient. Single focused
//     light source via `.hero-spotlight` over `.hero-grid`.

"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { WordRotate } from "@/components/ui/word-rotate";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { NumberTicker } from "@/components/ui/number-ticker";
import {
  ArrowRight, Cpu, Layers, ShieldCheck,
  Vault, Activity, Zap, Repeat, Shield, Wallet, Scale,
} from "lucide-react";
import {
  Button, Panel, ProofBadge, ProtocolIcon, StatusPill,
  type ProtocolSlug,
} from "@/components/primitives";
import {
  Section, SectionDivider, SectionIntro, ProductSurfaceCard,
  type CardAccent,
} from "@/components/sections";
import {
  HeroCounters, LiveRebalanceFeed, ProofLifecycle,
} from "@/components/narrative";
import { Meteors } from "@/components/magicui/meteors";
import { Spotlight } from "@/components/ui/spotlight";
import { OrbitingCircles } from "@/components/ui/orbiting-circles";
import dynamic from "next/dynamic";

// LiquidEther is a heavy WebGL fluid sim — lazy-load + SSR-disable
// so it never blocks the initial paint or the SSR pass.
const LiquidEther = dynamic(() => import("@/components/r3f/LiquidEther"), {
  ssr: false,
  loading: () => null,
});

// PillNav now lives in MarketingShell — global across all marketing
// routes. Removed from this page to avoid duplicate render.
import { fadeIn, heroLift, transitions } from "@/lib/motion";
import { PoweredByMarquee } from "@/components/marquee/PoweredByMarquee";
import { PrimitivesSection } from "@/components/primitives/PrimitivesSection";
import { ScrollReveal } from "@/components/scroll/ScrollReveal";
import { ParallaxLayer } from "@/components/scroll/ParallaxLayer";
import { Tilt3D } from "@/components/scroll/Tilt3D";
import { Terminal, AnimatedSpan, TypingAnimation } from "@/components/magicui/terminal";

export default function LandingPage(): JSX.Element {
  return (
    <>
      {/* parallax glow layer — drifts on scroll behind the hero */}
      <ParallaxLayer
        speed={0.3}
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-screen"
      >
        <div className="h-full w-full bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(63,140,255,0.12),transparent_70%)]" />
      </ParallaxLayer>

      <Hero />
      <ScrollReveal variant="rise" amount={0.3}>
        <PrimitivesSection />
      </ScrollReveal>
      <ScrollReveal variant="rise" delay={0.1}>
        <KpiStrip />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal variant="slide-left">
        <ProofLifecycleSection />
      </ScrollReveal>
      <ScrollReveal variant="slide-right" delay={0.15}>
        <ProductSurfacesSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal variant="rise">
        <TrustSection />
      </ScrollReveal>
      <ScrollReveal variant="rise" delay={0.1}>
        <LiveFeedSection />
      </ScrollReveal>
      <ScrollReveal variant="rise">
        <ArchitectureTimelineSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal variant="rise">
        <TerminalGridSection />
      </ScrollReveal>
      <SectionDivider />
      <ScrollReveal variant="fade" amount={0.1}>
        <CtaFooter />
      </ScrollReveal>
      <PoweredByMarquee />
    </>
  );
}

// `LiveStrip` + its `MARQUEE_SEED` were lifted out to
// `components/marquee/LiveStrip.tsx` and now mount inside
// MarketingShell as the top APY band, so it no longer collides
// with PillNav.

// ─────────────────────────────────────────────────────────────────
// 1. Hero — moment 1
// ─────────────────────────────────────────────────────────────────

function Hero(): JSX.Element {
  const root = useRef<HTMLElement>(null);

  // GSAP scroll story — pin the hero, scrub a timeline that scales
  // the globe, fades the headline up, and slides the KPI card. Skip
  // pin entirely on prefers-reduced-motion and on touch devices
  // (pinning at <1024px conflicts with momentum scroll).
  useGSAP(
    () => {
      if (typeof window === "undefined") return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const narrow = window.matchMedia("(max-width: 1023px)").matches;
      if (reduced || narrow) return;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      tl.to("[data-globe]",    { scale: 1.35, ease: "none" }, 0)
        .to("[data-headline]", { opacity: 0.2, y: -40 },       0)
        .from("[data-kpi]",    { y: 60, opacity: 0 },          0.2);

      return () => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
      };
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative overflow-hidden"
      style={{ minHeight: "min(100vh, 920px)" }}
    >
      {/* LiquidEther — fluid-shader backdrop. Behind everything in
          the hero. Atlas accent palette + low opacity so it reads as
          atmosphere, not foreground. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
      >
        <LiquidEther
          colors={["#3F8CFF", "#A682FF", "#F478C6"]}
          mouseForce={14}
          cursorSize={100}
          resolution={0.4}
          autoDemo
          autoSpeed={0.4}
          autoIntensity={1.8}
          takeoverDuration={0.25}
          autoResumeDelay={2400}
          autoRampDuration={0.8}
        />
      </div>
      {/* Aceternity Spotlight — soft conic backlight tinted with our
          electric accent. Sits behind everything else in the hero. */}
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill="#3F8CFF"
      />
      {/* Single focused light source — not a viewport-filling gradient. */}
      <div aria-hidden className="absolute inset-0 hero-spotlight pointer-events-none" />
      <div aria-hidden className="absolute inset-0 hero-grid pointer-events-none" />
      {/* Magic UI meteors — diagonal streaks above the grid, below text. */}
      <Meteors number={12} angle={215} className="opacity-50" />

      <div className="relative px-20 pt-20 pb-32 max-w-[1440px] mx-auto">
        {/* Live counters — top right, mono. */}
        <HeroCounters className="absolute top-12 right-20 hidden md:block w-[520px]" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center pt-24">
          <div className="lg:col-span-7">
            {/* zk-research-lab kicker */}
            <motion.div
              initial="hidden" animate="visible" variants={fadeIn}
              className="flex items-center gap-3"
            >
              <StatusPill variant="zk" compact>zk · groth16</StatusPill>
              <StatusPill variant="execute" compact>devnet · live</StatusPill>
              <span className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)] uppercase tracking-[0.08em]">
                colosseum frontier · 2026
              </span>
            </motion.div>

            <motion.h1
              data-headline
              initial="hidden" animate="visible" variants={heroLift}
              className="mt-7 font-display font-medium tracking-[-0.02em] leading-[0.95] text-[clamp(3.5rem,8vw,7rem)] max-w-[16ch]"
            >
              Autonomous treasury<br />
              {/* WordRotate cycles the verb so the kinetic accent
                  carries the same "verified by math" meaning across
                  three frames without flattening the headline. */}
              <span className="font-serif italic inline-block align-baseline" style={{ fontFamily: "var(--font-serif)" }}>
                <WordRotate
                  words={["verified", "proven", "settled"]}
                  duration={2200}
                  className="font-serif italic"
                />
              </span>{" "}
              by math.<br />
              On Solana.
            </motion.h1>

            <motion.div
              initial="hidden" animate="visible" variants={fadeIn}
              transition={{ delay: 0.10 }}
              className="mt-8 max-w-xl"
            >
              <p className="font-body text-lg leading-relaxed text-[color:var(--color-ink-secondary)]">
                AI manages allocations. zk proofs verify every move.{" "}
                <AnimatedGradientText className="font-body text-lg">
                  Trust the math, not the team.
                </AnimatedGradientText>
              </p>
            </motion.div>

            <motion.div
              initial="hidden" animate="visible" variants={fadeIn}
              transition={{ delay: 0.18 }}
              className="mt-10 flex flex-wrap items-center gap-4"
            >
              {/* Primary CTA → ShimmerButton (Magic UI). */}
              <Link href="/proofs/live">
                <ShimmerButton
                  shimmerColor="rgba(166,130,255,0.8)"
                  background="linear-gradient(90deg, var(--color-accent-zk), var(--color-accent-electric))"
                  className="font-body text-sm font-medium"
                >
                  Verify a proof in your browser
                  <ArrowRight className="ml-2 h-4 w-4 opacity-85 transition-transform duration-200 group-hover:translate-x-0.5" />
                </ShimmerButton>
              </Link>
              <Link href="/architecture">
                <Button variant="secondary" size="lg">
                  Read the architecture
                </Button>
              </Link>
            </motion.div>

            {/* The "demo-moment receipt" row — three minimal pills. */}
            <motion.div
              initial="hidden" animate="visible" variants={fadeIn}
              transition={{ delay: 0.24 }}
              className="mt-10 flex flex-wrap items-center gap-4 text-[12px] font-mono text-[color:var(--color-ink-tertiary)]"
            >
              <DemoReceipt n="01" label="verify in browser" tone="electric" />
              <span aria-hidden>·</span>
              <DemoReceipt n="02" label="treasury pre-warm" tone="zk" />
              <span aria-hidden>·</span>
              <DemoReceipt n="03" label="oracle-anomaly refusal" tone="proof" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: transitions.cinemaHero }}
            className="lg:col-span-5 relative flex flex-col items-center lg:items-end gap-6 min-h-[640px]"
          >
            {/* Magic UI OrbitingCircles — 2 concentric rings span the
                full right column behind everything. Big radii + bright
                glow so they're visible against Spotlight + Meteors. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[640px] w-[640px]">
                <OrbitingCircles radius={280} duration={32} iconSize={16} path>
                  <span className="block size-4 rounded-full bg-accent-electric shadow-[0_0_24px_rgba(63,140,255,0.9)]" />
                  <span className="block size-4 rounded-full bg-accent-zk shadow-[0_0_24px_rgba(166,130,255,0.9)]" />
                  <span className="block size-4 rounded-full bg-accent-execute shadow-[0_0_24px_rgba(60,227,154,0.9)]" />
                  <span className="block size-4 rounded-full bg-accent-proof shadow-[0_0_24px_rgba(244,120,198,0.9)]" />
                  <span className="block size-4 rounded-full bg-accent-warn shadow-[0_0_24px_rgba(247,185,85,0.9)]" />
                </OrbitingCircles>
                <OrbitingCircles radius={190} duration={22} iconSize={12} reverse path>
                  <span className="block size-3 rounded-full bg-accent-electric shadow-[0_0_18px_rgba(63,140,255,0.9)]" />
                  <span className="block size-3 rounded-full bg-accent-zk shadow-[0_0_18px_rgba(166,130,255,0.9)]" />
                  <span className="block size-3 rounded-full bg-accent-proof shadow-[0_0_18px_rgba(244,120,198,0.9)]" />
                  <span className="block size-3 rounded-full bg-accent-execute shadow-[0_0_18px_rgba(60,227,154,0.9)]" />
                </OrbitingCircles>
              </div>
            </div>

            <div data-kpi data-globe className="relative z-10">
              <Tilt3D intensity={5} className="will-change-transform">
                <VerifiedBalanceCard />
              </Tilt3D>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function DemoReceipt({
  n, label, tone,
}: { n: string; label: string; tone: "proof" | "zk" | "execute" | "electric" }): JSX.Element {
  const colour =
    tone === "proof"    ? "var(--color-accent-proof)"
    : tone === "zk"     ? "var(--color-accent-zk)"
    : tone === "electric" ? "var(--color-accent-electric)"
    : "var(--color-accent-execute)";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[10px]" style={{ color: colour }}>{n}</span>
      <span>{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hero — right-side "Verified balance" card
// ─────────────────────────────────────────────────────────────────

function VerifiedBalanceCard(): JSX.Element {
  // Compact glassy proof badge that floats in front of the rotating
  // proof orb. Carries the same data points as the previous large
  // card (verified · sp1 · groth16 · 11.84% APY · 142 verified
  // rebalances · 5-protocol allocation) but at ~half the footprint
  // so the orb behind it remains the visual anchor of the hero.
  const allocation: { brand: string; label: string }[] = [
    { brand: "#3CE39A", label: "kamino" },
    { brand: "#76E4F7", label: "drift" },
    { brand: "#C0FF4A", label: "marginfi" },
    { brand: "#C7F284", label: "jupiter" },
    { brand: "#A682FF", label: "raydium" },
  ];

  return (
    <div
      className="relative z-10 w-full max-w-[240px] rounded-[var(--radius-md)] overflow-hidden"
      style={{
        background: "color-mix(in oklab, var(--color-surface-raised) 92%, transparent)",
        backdropFilter: "blur(8px)",
        border: "1px solid var(--color-line-medium)",
        boxShadow:
          "inset 0 1px 0 color-mix(in oklab, var(--color-accent-zk) 20%, transparent), 0 12px 32px -16px rgba(166,130,255,0.45)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, var(--color-accent-zk), transparent)" }}
      />

      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full"
            style={{
              color: "var(--color-accent-execute)",
              border: "1px solid color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
              background: "color-mix(in oklab, var(--color-accent-execute) 8%, var(--color-surface-base))",
            }}
          >
            <ShieldCheck className="h-2 w-2" />
            verified
          </span>
          <span className="font-mono text-[8px] uppercase tracking-[0.12em]"
                style={{ color: "var(--color-ink-tertiary)" }}>
            sp1 · groth16
          </span>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <p className="font-mono text-[8px] uppercase tracking-[0.16em]"
             style={{ color: "var(--color-ink-tertiary)" }}>
            live apy
          </p>
          <p className="flex items-baseline gap-0.5 leading-none">
            <span
              className="font-mono font-semibold tabular-nums"
              style={{ color: "var(--color-accent-execute)", fontSize: "1.25rem" }}
            >
              11.84
            </span>
            <span
              className="font-mono"
              style={{ color: "var(--color-ink-tertiary)", fontSize: "0.75rem" }}
            >
              %
            </span>
          </p>
        </div>

        <div className="mt-2 h-px" style={{ background: "var(--color-line-soft)" }} />

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em]"
               style={{ color: "var(--color-ink-tertiary)" }}>
              verified rebalances
            </p>
            <p className="mt-0.5 font-mono text-[8px]"
               style={{ color: "var(--color-ink-secondary)" }}>
              all sp1-proven
            </p>
          </div>
          <span
            className="font-mono font-semibold tabular-nums"
            style={{ color: "var(--color-ink-primary)", fontSize: "0.9375rem" }}
          >
            142
          </span>
        </div>

        <div className="mt-2 h-px" style={{ background: "var(--color-line-soft)" }} />

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[8px] uppercase tracking-[0.14em]"
             style={{ color: "var(--color-ink-tertiary)" }}>
            allocated
          </p>
          <div className="flex items-center gap-1">
            {allocation.map((a) => (
              <span
                key={a.label}
                className="inline-block h-1 w-1 rounded-full"
                style={{ background: a.brand }}
                title={a.label}
                aria-label={a.label}
              />
            ))}
            <span className="ml-1 font-mono text-[8px]"
                  style={{ color: "var(--color-ink-tertiary)" }}>
              + sp1 zkVM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// KPI strip — Magic UI Terminal pane below the hero. Replaces the
// hand-rolled terminal block (TerminalHeader + KpiLines + Recipe +
// Intelligence + Running). Same Atlas KPIs, half the markup.
// ─────────────────────────────────────────────────────────────────

function KpiStrip(): JSX.Element {
  return (
    <Section variant="default">
      <Terminal className="mx-auto w-full max-w-[1100px] bg-[color:var(--color-surface-sunken)]">
        <TypingAnimation>&gt; atlas status --live</TypingAnimation>

        <AnimatedSpan delay={1200} className="text-[color:var(--color-accent-execute)]">
          <span>✔ verified apy   :  4.98%</span>
        </AnimatedSpan>
        <AnimatedSpan delay={1500} className="text-[color:var(--color-accent-execute)]">
          <span>✔ boost apy      :  8.67%</span>
        </AnimatedSpan>
        <AnimatedSpan delay={1800} className="text-[color:var(--color-accent-execute)]">
          <span>✔ tvl targeted   :  $100M+</span>
        </AnimatedSpan>
        <AnimatedSpan delay={2100} className="text-[color:var(--color-accent-execute)]">
          <span>✔ proofs settled :  142  (24h)</span>
        </AnimatedSpan>
        <AnimatedSpan delay={2400} className="text-[color:var(--color-accent-execute)]">
          <span>✔ refusal floor  :  1 / 7  hard veto</span>
        </AnimatedSpan>

        <AnimatedSpan delay={2800} className="text-[color:var(--color-ink-tertiary)]">
          <span>─ every number proof-bound, not interpolated ─</span>
        </AnimatedSpan>

        <AnimatedSpan delay={3300} className="text-[color:var(--color-accent-electric)]">
          <span>ℹ how atlas compounds yield</span>
          <span className="pl-2">[ VERIFIED ]  +  [ BOOST ]</span>
        </AnimatedSpan>

        <AnimatedSpan delay={3800} className="text-[color:var(--color-ink-secondary)]">
          <span>verified apy pays drift / kamino / jupiter, gated by</span>
          <span>groth16 receipt. boost apy layers funding-capture sleeves</span>
          <span>under the same 7-agent ensemble.</span>
        </AnimatedSpan>

        <AnimatedSpan delay={4500} className="text-[color:var(--color-accent-warn)]">
          <span>─ intelligence — 8 week projection ─</span>
        </AnimatedSpan>
        <AnimatedSpan delay={4800} className="text-[color:var(--color-ink-secondary)]">
          <span>baseline   $42M  →  $58M</span>
        </AnimatedSpan>
        <AnimatedSpan delay={5100} className="text-[color:var(--color-accent-electric)]">
          <span>atlas      $42M  →  $108M</span>
        </AnimatedSpan>
        <AnimatedSpan delay={5400} className="text-[color:var(--color-accent-execute)]">
          <span>+$50M USDC · top-5 +$31M · new +$19M</span>
        </AnimatedSpan>

        <TypingAnimation delay={5900} className="text-[color:var(--color-ink-tertiary)]">
          proof feed ready. 1 action available.
        </TypingAnimation>
      </Terminal>
    </Section>
  );
}


// `HeroCounters` lives in components/narrative — it owns the SDK
// query + realtime store wiring + the one-shot count-up tween.

// ─────────────────────────────────────────────────────────────────
// 2. Proof lifecycle — moment 1
// ─────────────────────────────────────────────────────────────────

function ProofLifecycleSection(): JSX.Element {
  return (
    <Section variant="default">
      <SectionIntro
        kicker="proof lifecycle · phase 01–19"
        title="Eight stages. Every one verifiable."
        subhead={
          <>
            From quorum ingestion to mainnet settlement, each stage
            carries an SLO and a public-input commitment. Click any
            stage on{" "}
            <Link href="/architecture" className="text-[color:var(--color-accent-electric)] hover:underline">
              /architecture
            </Link>{" "}
            for the file-level walkthrough.
          </>
        }
      />
      <Panel surface="raised" density="default" className="mt-12">
        <ProofLifecycle />
      </Panel>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────
// 3. Three product surfaces — moments 2 + 3
// ─────────────────────────────────────────────────────────────────

interface Surface {
  eyebrow: string;
  title: string;
  body: string;
  cta: { href: string; label: string };
  kpiValue: string;
  kpiLabel: string;
  accent: CardAccent;
}

const SURFACES: readonly Surface[] = [
  {
    eyebrow: "atlas protocol",
    title: "On-chain verifier + custody.",
    body: "The vault programs, the public-input layout, the SP1 verifier on Solana. Every settlement bound to a Groth16 receipt — invalid proofs reject at the program ix entry.",
    cta: { href: "/architecture", label: "Open the diagram" },
    kpiValue: "150",
    kpiLabel: "slots · max proof age",
    accent: "electric",
  },
  {
    eyebrow: "atlas vault",
    title: "AI-managed allocations.",
    body: "Seven specialist agents (risk · yield · liquidity · tail · compliance · execution · observer) propose; quorum decides; explanation is folded into the public input. No agent can sign alone.",
    cta: { href: "/decision-engine", label: "See the engine" },
    kpiValue: "7",
    kpiLabel: "agents · per ensemble",
    accent: "zk",
  },
  {
    eyebrow: "atlas treasury os",
    title: "Stablecoin payouts, pre-warmed by proof.",
    body: "Schedule a payout. Atlas pre-warms the buffer across multiple proofs to land deadline-safe. Adaptive DCA, runway projections, Squads multisig — every action proof-anchored.",
    cta: { href: "/treasury", label: "Open Treasury OS" },
    kpiValue: "≤ 4",
    kpiLabel: "buffer pre-warm proofs",
    accent: "execute",
  },
];

const ROUTES_THROUGH: readonly ProtocolSlug[] = [
  "solana", "kamino", "drift", "marginfi", "jupiter", "pyth", "jito", "squads",
];

function ProductSurfacesSection(): JSX.Element {
  return (
    <Section variant="default">
      <SectionIntro
        kicker="product surfaces"
        title="One protocol. Two operator surfaces. One promise."
      />

      {/* Real protocol marks — Atlas integrates everywhere. */}
      <div className="mt-12 mb-12 flex items-center gap-8 flex-wrap">
        <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]">
          routes through
        </span>
        <ul className="flex items-center gap-5 flex-wrap">
          {ROUTES_THROUGH.map((slug) => (
            <li key={slug}>
              <ProtocolIcon slug={slug} size={56} surface="disc" glow />
            </li>
          ))}
        </ul>
        <span className="font-mono text-xs text-[color:var(--color-ink-tertiary)]">
          + sp1 zkVM · pyth pull oracles
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {SURFACES.map((s) => (
          <ProductSurfaceCard
            key={s.eyebrow}
            eyebrow={s.eyebrow}
            title={s.title}
            body={s.body}
            kpiValue={s.kpiValue}
            kpiLabel={s.kpiLabel}
            cta={s.cta}
            accent={s.accent}
          />
        ))}
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────
// 4. Trust posture
// ─────────────────────────────────────────────────────────────────

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

function TrustSection(): JSX.Element {
  return (
    <Section variant="cinematic">
      <SectionIntro
        kicker="trust posture"
        title="Atlas does not require trust. It is structurally checkable."
      />
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {TRUST_COLUMNS.map((col) => (
          <Panel key={col.title} surface="raised" density="default">
            <div className="flex items-center gap-2 mb-5">
              <col.icon className="h-4 w-4 text-[color:var(--color-accent-electric)]" />
              <h3 className="font-display font-semibold tracking-tight text-xl text-[color:var(--color-ink-primary)]">
                {col.title}
              </h3>
            </div>
            <ul className="flex flex-col gap-4">
              {col.invariants.map((inv) => (
                <li key={inv.id}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-accent-zk)]">
                    {inv.id}
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.6] text-[color:var(--color-ink-secondary)]">
                    {inv.text}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────
// 5. Live rebalance feed
// ─────────────────────────────────────────────────────────────────

function LiveFeedSection(): JSX.Element {
  return (
    <Section variant="default">
      <SectionIntro
        kicker="live · public stream"
        title="Every move, visible."
        aside={
          <div className="flex items-center gap-3">
            <ProofBadge hash="a1b2c3d4e5f60718" variant="verified" compact />
            <Link
              href="/proofs/live"
              className="font-medium text-sm text-[color:var(--color-accent-electric)] hover:text-[color:var(--color-ink-primary)] underline-offset-2"
            >
              open proof explorer →
            </Link>
          </div>
        }
      />
      <div className="mt-12">
        <LiveRebalanceFeed limit={10} />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────
// 6. Architecture timeline pills
// ─────────────────────────────────────────────────────────────────

const PHASES: { id: string; label: string; tone: "neutral" | "zk" | "execute" }[] = [
  { id: "01", label: "primitives",        tone: "neutral" },
  { id: "03", label: "verifier",          tone: "zk" },
  { id: "05", label: "feature pipeline",  tone: "neutral" },
  { id: "07", label: "private execution", tone: "zk" },
  { id: "09", label: "decision engine",   tone: "neutral" },
  { id: "11", label: "intelligence",      tone: "neutral" },
  { id: "13", label: "alerts & viewing keys", tone: "neutral" },
  { id: "15", label: "proof archival",    tone: "zk" },
  { id: "17", label: "infra observatory", tone: "execute" },
  { id: "19", label: "qvac · local-first",tone: "neutral" },
  { id: "24", label: "frontend final",    tone: "execute" },
];

function ArchitectureTimelineSection(): JSX.Element {
  return (
    <Section variant="default">
      <SectionIntro
        kicker="architecture timeline"
        title="Twenty-four phases. One contract."
        aside={
          <Link
            href="/architecture"
            className="font-medium text-sm text-[color:var(--color-accent-electric)] hover:text-[color:var(--color-ink-primary)] underline-offset-2"
          >
            play story →
          </Link>
        }
      />
      <div className="mt-12 flex items-center gap-2 overflow-x-auto scroll-area pb-2">
        {PHASES.map((p, i) => (
          <span key={p.id} className="flex items-center gap-2 flex-none">
            <PhasePill id={p.id} label={p.label} tone={p.tone} />
            {i < PHASES.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-[color:var(--color-line-medium)]" />
            )}
          </span>
        ))}
      </div>
    </Section>
  );
}

function PhasePill({
  id, label, tone,
}: {
  id: string; label: string; tone: "neutral" | "zk" | "execute";
}): JSX.Element {
  const colour =
    tone === "zk"      ? "var(--color-accent-zk)"
    : tone === "execute" ? "var(--color-accent-execute)"
    : "var(--color-ink-secondary)";
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-raised)]">
      <span className="font-mono text-[10px]" style={{ color: colour }}>{id}</span>
      <span className="text-[12px] text-[color:var(--color-ink-secondary)]">{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// 6.5. Terminal grid — direct jump-offs to operator surfaces.
//      Lulo-style large bold cards. Each one redirects from the
//      home page straight into the matching terminal route, with
//      keyboard shortcut hints so power users see the path.
// ─────────────────────────────────────────────────────────────────

const TERMINAL_TILES: ReadonlyArray<{
  href: string;
  label: string;
  blurb: string;
  shortcut?: string;
  Icon: typeof Vault;
  tone: "electric" | "zk" | "execute" | "warn" | "proof" | "neutral";
}> = [
  { href: "/vaults",         label: "Vaults",         blurb: "Allocations, APY, depositor flow.",         shortcut: "g v", Icon: Vault,     tone: "electric" },
  { href: "/rebalance/live", label: "Live rebalance", blurb: "Streaming receipts as they verify.",        shortcut: "g r", Icon: Activity,  tone: "execute"  },
  { href: "/triggers",       label: "Triggers",       blurb: "Conditional execution, scheduled.",         Icon: Zap,                       tone: "warn"     },
  { href: "/recurring",      label: "Recurring",      blurb: "DCA + payroll + scheduled rebalances.",     Icon: Repeat,                    tone: "zk"       },
  { href: "/hedging",        label: "Hedging",        blurb: "Perp / option sleeves with proofs.",        Icon: Shield,                    tone: "proof"    },
  { href: "/treasury",       label: "Treasury",       blurb: "Runway, payments, confidential ledger.",    shortcut: "g t", Icon: Wallet,    tone: "electric" },
  { href: "/governance",     label: "Governance",     blurb: "Models, agents, model-card commits.",       Icon: Scale,                     tone: "neutral"  },
];

const TILE_TONE: Record<string, { fg: string; ring: string; bg: string }> = {
  electric: { fg: "var(--color-accent-electric)", ring: "rgba(46,160,255,0.35)",  bg: "color-mix(in oklab, var(--color-accent-electric) 10%, transparent)" },
  zk:       { fg: "var(--color-accent-zk)",       ring: "rgba(166,130,255,0.35)", bg: "color-mix(in oklab, var(--color-accent-zk) 10%, transparent)" },
  execute:  { fg: "var(--color-accent-execute)",  ring: "rgba(60,227,154,0.35)",  bg: "color-mix(in oklab, var(--color-accent-execute) 10%, transparent)" },
  warn:     { fg: "var(--color-accent-warn)",     ring: "rgba(247,185,85,0.35)",  bg: "color-mix(in oklab, var(--color-accent-warn) 10%, transparent)" },
  proof:    { fg: "var(--color-accent-proof)",    ring: "rgba(125,211,252,0.35)", bg: "color-mix(in oklab, var(--color-accent-proof) 10%, transparent)" },
  neutral:  { fg: "var(--color-ink-secondary)",   ring: "rgba(255,255,255,0.18)", bg: "var(--color-surface-sunken)" },
};

function TerminalGridSection(): JSX.Element {
  return (
    <Section variant="default">
      <SectionIntro
        kicker="terminal"
        title="Jump straight to where the work happens."
        aside={
          <Link
            href="/dashboard"
            className="font-medium text-sm text-[color:var(--color-accent-electric)] hover:text-[color:var(--color-ink-primary)] underline-offset-2"
          >
            open dashboard →
          </Link>
        }
      />
      <div className="mt-12 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TERMINAL_TILES.map((t) => {
          const tone = TILE_TONE[t.tone]!;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group relative flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5 overflow-hidden
                         transition-[border-color,background] duration-200 ease-[var(--ease-glide)]
                         hover:border-[color:var(--color-line-medium)]"
              style={{
                borderColor: "var(--color-line-soft)",
                background: "var(--color-surface-raised)",
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: tone.bg }}
              />
              <div className="relative flex items-center justify-between">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border"
                  style={{ borderColor: tone.ring, background: tone.bg, color: tone.fg }}
                >
                  <t.Icon className="h-4 w-4" />
                </span>
                {t.shortcut && (
                  <kbd
                    className="font-mono text-[10px] uppercase tracking-[0.12em] rounded-[4px] border px-1.5 py-0.5"
                    style={{
                      borderColor: "var(--color-line-soft)",
                      color: "var(--color-ink-tertiary)",
                    }}
                  >
                    {t.shortcut}
                  </kbd>
                )}
              </div>
              <div className="relative">
                <h3 className="font-display font-semibold text-[20px] leading-[1.15] tracking-tight text-[color:var(--color-ink-primary)]">
                  {t.label}
                </h3>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-[color:var(--color-ink-secondary)]">
                  {t.blurb}
                </p>
              </div>
              <div className="relative mt-auto pt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
                   style={{ color: tone.fg }}>
                open
                <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────────
// 7. CTA footer
// ─────────────────────────────────────────────────────────────────

function CtaFooter(): JSX.Element {
  return (
    <Section variant="cinematic">
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-line-soft)] px-12 md:px-16 py-16 md:py-20"
        style={{ background: "var(--color-surface-raised)" }}
      >
        <div aria-hidden className="absolute inset-0 hero-spotlight pointer-events-none" />
        <div className="relative max-w-[760px]">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]">
            connect · read · decide
          </p>
          <h2 className="mt-6 font-display font-semibold tracking-tight leading-[1.05] text-[clamp(2.5rem,5vw,3.5rem)] text-[color:var(--color-ink-primary)]">
            Trust the math. Not the team.
          </h2>
          <p className="mt-8 font-body text-sm leading-[1.6] text-[color:var(--color-ink-secondary)] max-w-[60ch]">
            Atlas ships every rebalance with a Groth16 proof verified
            on-chain. Open the explorer, pick any rebalance, click
            verify-in-browser — Atlas does not ask you to trust it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/proofs/live">
              <Button variant="primary">
                Verify a recent proof
                <ArrowRight
                  className="h-4 w-4 opacity-85
                             transition-transform duration-200 ease-[var(--ease-glide)]
                             group-hover:translate-x-0.5"
                />
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="ghost" size="lg">
                Read the docs
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

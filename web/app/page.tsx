"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Cpu, Layers, Sparkles, Zap } from "lucide-react";
import { HeroOrb } from "@/components/HeroOrb";
import { StatsCounter } from "@/components/StatsCounter";
import { ProofPipeline } from "@/components/ProofPipeline";
import { Footer } from "@/components/Footer";
import { Showcase } from "@/components/Showcase";

export default function Home() {
  return (
    <main className="relative">
      {/* hero w/ Birdeye-style grid (grid contained to this block only) */}
      <section className="relative pt-12 pb-16 overflow-hidden">
        {/* grid bg — contained to hero only */}
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(150,130,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(150,130,255,0.22) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 90% at 50% 40%, #000 30%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 40%, #000 30%, transparent 90%)",
          }}
        />
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(120,220,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(120,220,255,0.07) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            maskImage: "radial-gradient(ellipse 80% 90% at 50% 40%, #000 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 40%, #000 20%, transparent 80%)",
          }}
        />
        {/* subtle accent blob inside hero only */}
        <div
          className="absolute top-[-10%] left-[10%] h-[400px] w-[400px] rounded-full blur-[140px] -z-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(124,92,255,0.30) 0%, transparent 70%)" }}
        />

        <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-[color:var(--color-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] animate-pulse" />
              Live on Solana · Frontier hackathon 2026
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-[1.02] tracking-tight">
              AI savings you can{" "}
              <span className="text-gradient">verify</span>.
            </h1>

            <p className="text-lg text-[color:var(--color-muted)] max-w-xl leading-relaxed">
              Deposit USDC. An AI agent rebalances across Kamino, Drift and Jupiter for the
              best yield — and every move ships with an onchain ZK proof. The curator
              literally cannot rug or deviate from the strategy you signed up for.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/vaults/atUSDC-v1"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] px-6 py-3 font-medium text-white glow-accent hover:opacity-95 transition"
              >
                Open the vault
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-xl glass px-6 py-3 hover:bg-white/5 transition"
              >
                How proofs work
                <Sparkles className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 max-w-md">
              <Stat label="Protocols" value={4} />
              <Stat label="Proof time" value={32} suffix="s" />
              <Stat label="Verifier cost" value={0.0001} prefix="$" decimals={4} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <HeroOrb />
          </motion.div>
        </div>
        </div>
      </section>

      {/* feature pillars */}
      <section className="mx-auto max-w-6xl px-6 py-16 mt-16">
        <SectionHead
          eyebrow="Three layers · one product"
          title="Infra, DeFi, Consumer."
          body="Atlas spans a zkML coprocessor, a yield vault, and a consumer app. One repo, one pitch, one trust model."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Pillar
            icon={<Cpu />}
            tag="Infra"
            title="zkML coprocessor"
            body="SP1 zkVM + sp1-solana Groth16 verifier. Open SDK any Solana program can call via CPI to consume proven AI outputs."
            accent="#7c5cff"
          />
          <Pillar
            icon={<Layers />}
            tag="DeFi"
            title="Verified yield vault"
            body="Token-2022 USDC vault. Strategy committed at deposit. Rebalances across Kamino, Drift, Jupiter, marginfi gated by SP1 proof."
            accent="#29d3ff"
          />
          <Pillar
            icon={<Sparkles />}
            tag="Consumer"
            title="One-tap savings"
            body="Wallet-standard or passkey login. Live proof feed. Solana Blinks make deposits viral straight from social feeds."
            accent="#ff5cf0"
          />
        </div>
      </section>

      {/* Apple-style parallax showcase */}
      <Showcase />

      {/* pipeline */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <SectionHead
          eyebrow="Proof flow"
          title="From state to settlement."
          body="Every rebalance is a one-shot pipeline: snapshot, infer, prove, wrap, verify, execute. If anything is off — the Solana program rejects the tx."
        />
        <div className="glass rounded-3xl p-8 md:p-12">
          <ProofPipeline />
        </div>
      </section>

      {/* trust strip */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="glass rounded-3xl p-10 grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
          <div className="md:col-span-2 space-y-3">
            <div className="inline-flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--color-success)]" />
              Audited primitives
            </div>
            <div className="text-3xl font-semibold leading-tight">
              Composed from production-shipped Solana cryptography.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              "SP1 zkVM",
              "sp1-solana",
              "Token-2022",
              "alt_bn128",
              "Anchor 0.32",
              "Jito bundles",
              "Light Protocol",
              "State compress",
            ].map((b) => (
              <div key={b} className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs font-mono text-[color:var(--color-muted)] text-center">
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl glass p-12 text-center"
        >
          <div className="absolute inset-0 -z-10 opacity-50"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(124,92,255,0.4), transparent 60%), radial-gradient(circle at 70% 70%, rgba(41,211,255,0.3), transparent 60%)",
            }}
          />
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs mb-6">
            <Zap className="h-3 w-3 text-[color:var(--color-warn)]" />
            Frontier hackathon · ships May 2026
          </div>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight max-w-2xl mx-auto">
            <span className="text-gradient-subtle">Trust the math,</span>{" "}
            <span className="text-gradient">not the team.</span>
          </h2>
          <p className="text-[color:var(--color-muted)] max-w-xl mx-auto mt-4">
            Open Atlas Vault. Deposit any amount of USDC. Watch every rebalance prove itself
            onchain in front of you.
          </p>
          <div className="flex justify-center gap-3 mt-8">
            <Link
              href="/vaults/atUSDC-v1"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] px-6 py-3 font-medium text-white glow-accent"
            >
              Open vault
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-xl glass px-6 py-3 hover:bg-white/5"
            >
              Read the spec
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="mb-10 max-w-2xl"
    >
      <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent-2)] mb-3">{eyebrow}</div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{title}</h2>
      <p className="text-[color:var(--color-muted)] leading-relaxed">{body}</p>
    </motion.div>
  );
}

function Pillar({
  icon,
  tag,
  title,
  body,
  accent,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="group glass rounded-2xl p-6 relative overflow-hidden"
    >
      <div
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition"
        style={{ background: accent }}
      />
      <div className="relative">
        <div
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4"
          style={{ background: `${accent}22`, color: accent }}
        >
          {icon}
        </div>
        <div className="text-xs font-mono uppercase tracking-widest text-[color:var(--color-muted)] mb-1">
          {tag}
        </div>
        <div className="text-xl font-semibold mb-2">{title}</div>
        <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">{body}</p>
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  prefix,
  suffix,
  decimals,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div>
      <div className="text-2xl font-bold tracking-tight">
        <StatsCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <div className="text-xs text-[color:var(--color-muted)] mt-1">{label}</div>
    </div>
  );
}

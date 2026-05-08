// /docs — documentation home.
//
// Layout:
//   1. Hero        — eyebrow + headline + subhead + Pleiades art
//   2. Three cards — depositors / builders / treasuries
//   3. Quick links — six popular pages, two columns
//   4. Read source — github / npm / crates
//
// Hard-coded content; no MDX, no fetches. The shell (top nav,
// sidebar, right rail, ask bar) is provided by the parent layout.

"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Building2, Code2, Github, Package, Wallet,
} from "lucide-react";
import { AskQuestionBar } from "@/components/docs";

interface NavCard {
  href: string;
  title: string;
  description: string;
  cta: string;
  Icon: typeof Wallet;
}

const NAV_CARDS: ReadonlyArray<NavCard> = [
  {
    href: "/docs/how-it-works",
    title: "For depositors",
    description:
      "Understand how Atlas keeps your money safe, how the AI decides where to put it, and how to verify every move yourself.",
    cta: "How Atlas works",
    Icon: Wallet,
  },
  {
    href: "/docs/quickstart",
    title: "For builders",
    description:
      "TypeScript and Rust SDKs, REST + WebSocket APIs, webhooks, and the verify-inference CPI primitive any Solana program can call.",
    cta: "Quickstart",
    Icon: Code2,
  },
  {
    href: "/docs/treasury",
    title: "For treasuries",
    description:
      "Run a DAO, startup, or business treasury on Atlas. Squads multisig, cashflow-aware pre-warm, runway forecasting, unified ledger.",
    cta: "Treasury OS",
    Icon: Building2,
  },
];

const QUICK_LINKS: ReadonlyArray<{ href: string; title: string; blurb: string }> = [
  { href: "/docs/how-it-works",                    title: "How Atlas works",                  blurb: "From deposit to verified rebalance." },
  { href: "/docs/philosophy/the-26-invariants",    title: "The 26 invariants",                blurb: "Each promise, in plain language." },
  { href: "/docs/vault/proof-verification",        title: "Verify a proof in your browser",   blurb: "Run the verifier client-side." },
  { href: "/docs/api",                             title: "REST API reference",               blurb: "REST and WebSocket endpoints." },
  { href: "/docs/sdk",                             title: "SDK quickstart",                   blurb: "TypeScript and Rust." },
  { href: "/docs/philosophy/why-we-built-this",    title: "Why Solana, not EVM",              blurb: "The thesis behind the chain choice." },
];

export default function DocsHome(): JSX.Element {
  return (
    <>
      <div className="flex flex-col gap-20">

        {/* ── 1. Hero ────────────────────────────────────────────── */}
        <section className="flex flex-col lg:flex-row items-start lg:items-center gap-10 lg:gap-16">
          <div className="flex-1 flex flex-col gap-6 max-w-[640px]">
            <p
              className="font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: "var(--color-ink-tertiary)" }}
            >
              Atlas Documentation
            </p>
            <h1
              className="font-display font-semibold tracking-tight leading-[1.05]
                         text-[clamp(2.25rem,5vw,3.25rem)]"
              style={{ color: "var(--color-ink-primary)" }}
            >
              Build on, integrate with, or just understand Atlas.
            </h1>
            <p
              className="font-body text-[18px] leading-[1.55] max-w-[560px]"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              Autonomous, zk-verified treasury infrastructure for stablecoin
              capital on Solana. Pick where you want to start.
            </p>
          </div>
          <div className="hidden lg:block shrink-0">
            <Image
              src="/brand/atlas-pleiades.svg"
              alt=""
              width={420}
              height={420}
              priority
              className="opacity-85"
            />
          </div>
        </section>

        {/* ── 2. Three cards ─────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col gap-4 rounded-[var(--radius-lg)] border p-7
                         transition-[border-color,transform] duration-200 ease-[var(--ease-glide)]
                         hover:-translate-y-0.5
                         hover:border-[color:color-mix(in_oklab,var(--color-accent-electric)_55%,var(--color-line-medium))]"
              style={{
                borderColor: "var(--color-line-medium)",
                background: "var(--color-surface-raised)",
              }}
            >
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)]"
                style={{
                  background: "var(--color-surface-sunken)",
                  color: "var(--color-accent-electric)",
                }}
              >
                <c.Icon className="h-5 w-5" />
              </span>
              <h3
                className="font-display font-semibold text-[20px] tracking-tight leading-[1.2]"
                style={{ color: "var(--color-ink-primary)" }}
              >
                {c.title}
              </h3>
              <p
                className="font-body text-[14px] leading-[1.55] flex-1"
                style={{ color: "var(--color-ink-secondary)" }}
              >
                {c.description}
              </p>
              <span
                className="inline-flex items-center gap-1.5 text-[13px] font-medium mt-1"
                style={{ color: "var(--color-accent-electric)" }}
              >
                {c.cta}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>

        {/* ── 3. Quick links ─────────────────────────────────────── */}
        <section className="flex flex-col gap-6">
          <h2
            className="font-display font-medium text-[20px] tracking-tight"
            style={{ color: "var(--color-ink-primary)" }}
          >
            Popular pages
          </h2>
          <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {QUICK_LINKS.map((q) => (
              <li key={q.href}>
                <Link
                  href={q.href}
                  className="group flex items-baseline justify-between gap-3 py-1.5 border-b"
                  style={{ borderColor: "var(--color-line-soft)" }}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px]" style={{ color: "var(--color-ink-primary)" }}>
                      {q.title}
                    </span>
                    <span className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      {q.blurb}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-3 w-3 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{ color: "var(--color-ink-tertiary)" }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 4. Read the source ─────────────────────────────────── */}
        <section
          className="rounded-[var(--radius-lg)] border p-8 mb-24"
          style={{
            borderColor: "var(--color-line-soft)",
            background: "var(--color-surface-raised)",
          }}
        >
          <h2
            className="font-display font-semibold text-[22px] tracking-tight"
            style={{ color: "var(--color-ink-primary)" }}
          >
            Read the source
          </h2>
          <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: "var(--color-ink-secondary)" }}>
            Atlas is open source. Apache-2.0. Bug bounty soon.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="https://github.com/atlas-fi"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] border text-[13px]
                         text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
              style={{ borderColor: "var(--color-line-soft)" }}
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@atlas/sdk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] border text-[13px]
                         text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
              style={{ borderColor: "var(--color-line-soft)" }}
            >
              <Package className="h-4 w-4" /> @atlas/sdk
            </a>
            <a
              href="https://crates.io/crates/atlas-rs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-md)] border text-[13px]
                         text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
              style={{ borderColor: "var(--color-line-soft)" }}
            >
              <Package className="h-4 w-4" /> atlas-rs
            </a>
          </div>
        </section>
      </div>

      <AskQuestionBar />
    </>
  );
}

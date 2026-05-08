// apps/web — atlasfi.in marketing surface (PR1 scaffold).
//
// Today this page is a thin pointer: the canonical landing still
// lives at atlas/web/app/(marketing)/page.tsx and that's what the
// dev server on :3000 serves. Once apps/web takes over the Vercel
// deployment, the migrated landing replaces this stub.

import { Marquee, adaptDefiLlama } from "@atlas/ui";

export default function Page(): JSX.Element {
  // Placeholder venues — real DeFiLlama integration ships when the
  // marketing surface migrates over.
  const items = adaptDefiLlama([
    { pool: "kamino-usdc", project: "kamino",   symbol: "USDC", apy: 11.84, tvlUsd: 410_000_000 },
    { pool: "drift-ksol",  project: "drift",    symbol: "kSOL", apy: 18.20, tvlUsd: 180_000_000 },
    { pool: "marginfi-usdc", project: "marginfi", symbol: "USDC", apy: 9.40, tvlUsd: 220_000_000 },
    { pool: "jupiter-jlp", project: "jupiter",  symbol: "JLP",  apy: 14.10, tvlUsd: 1_200_000_000 },
  ]);

  return (
    <main className="min-h-screen">
      <Marquee items={items} />
      <section className="px-8 py-32 max-w-6xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: "var(--color-ink-tertiary)" }}>
          atlasfi.in · pr 1 scaffold
        </p>
        <h1
          className="mt-6 font-display font-medium tracking-[-0.02em] leading-[0.95]"
          style={{ fontSize: "clamp(3.5rem, 8vw, 7rem)", color: "var(--color-ink-primary)" }}
        >
          Autonomous treasury<br />
          <span className="font-serif italic">verified by math</span>.<br />
          On Solana.
        </h1>
        <p
          className="mt-8 max-w-xl font-body text-lg leading-relaxed"
          style={{ color: "var(--color-ink-secondary)" }}
        >
          Migration in flight. Canonical landing remains at the
          existing <code style={{ color: "var(--color-accent-electric)" }}>atlas/web</code> deployment until
          DNS cuts over. PR 2 lands the full hero card + KPI strip on this surface.
        </p>
      </section>
    </main>
  );
}

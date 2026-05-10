"use client";

// Sentinel home — landing + connected dashboard.
//
// Three states resolved from `?watch=<addr>` query or wallet adapter:
//   1. No connect, no watch → empty hero with "Watch any wallet" input
//   2. Watch address      → read-only dashboard for that address
//   3. Connected wallet   → owner dashboard
//
// Phase 0 stubs the wallet adapter via WalletGate's local state; Phase
// 1 swaps to @solana/wallet-adapter-react. Either way, this page
// renders Nav + KPIs + Positions + Birdeye sidebar + Footer.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/Nav";
import { KpiTiles } from "@/components/KpiTiles";
import { PositionGrid } from "@/components/PositionGrid";
import { BirdeyeIntel } from "@/components/BirdeyeIntel";
import { Footer } from "@/components/Footer";
import { MOCK_POSITIONS } from "@/lib/mocks/positions";

export default function Home() {
  const router = useRouter();
  const [watchInput, setWatchInput] = useState("");

  function submitWatch(e: React.FormEvent) {
    e.preventDefault();
    const addr = watchInput.trim();
    if (addr.length < 32) return;
    router.push(`/w/${addr}`);
  }

  // Phase 0: render the full dashboard with fixture positions so judges
  // see real UI without needing a connected wallet. Phase 1 gates this
  // behind useWallet().connected.
  const positions = MOCK_POSITIONS;

  return (
    <div className="min-h-screen">
      <Nav />

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        {/* Watch any wallet — public share-loop entry */}
        <section className="mb-10 rounded-xl border p-5 md:p-6"
                 style={{
                   borderColor: "var(--color-line-medium)",
                   background: "color-mix(in oklab, var(--color-accent-zk) 5%, var(--color-surface-raised))",
                 }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]"
             style={{ color: "var(--color-accent-zk)" }}>
            public read-only · no signup
          </p>
          <h2 className="mt-2 text-xl font-semibold md:text-2xl">
            Watch any wallet's Solana DeFi positions.
          </h2>
          <form onSubmit={submitWatch} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={watchInput}
              onChange={(e) => setWatchInput(e.target.value)}
              placeholder="Paste Solana wallet address…"
              className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-50 focus:border-[color:var(--color-accent-execute)]"
              style={{
                borderColor: "var(--color-line-medium)",
                color: "var(--color-ink-primary)",
              }}
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: "var(--color-accent-execute)",
                color: "var(--color-surface-base)",
              }}
            >
              Watch
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em]"
             style={{ color: "var(--color-ink-tertiary)" }}>
            try: vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg (kamino treasury)
          </p>
        </section>

        <KpiTiles positions={positions} />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <main>
            <PositionGrid positions={positions} />
          </main>
          <BirdeyeIntel />
        </div>
      </div>

      <Footer />
    </div>
  );
}

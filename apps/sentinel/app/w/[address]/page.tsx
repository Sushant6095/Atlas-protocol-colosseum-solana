"use client";

// /w/<address> — read-only viewer for any Solana wallet.
// Phase 0: shows the same fixture data for any address that passes
// length-based validity. Phase 1 will fetch the wallet's actual
// Kamino positions via Quicknode + Kamino SDK and gracefully fall
// back to empty-state if there are none.

import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { KpiTiles } from "@/components/KpiTiles";
import { PositionGrid } from "@/components/PositionGrid";
import { BirdeyeIntel } from "@/components/BirdeyeIntel";
import { Footer } from "@/components/Footer";
import { MOCK_POSITIONS } from "@/lib/mocks/positions";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const KAMINO_TREASURY = "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg";

export default function WatchPage() {
  const params = useParams<{ address: string }>();
  const address = params?.address ?? "";

  // Phase 0 heuristic: known Kamino treasury → mock positions.
  // Anything else → empty state, so the empty-wallet UI gets visible.
  // Phase 1 replaces this entire block with a real Kamino SDK fetch.
  const isKnownTreasury = address === KAMINO_TREASURY;
  const positions = isKnownTreasury ? MOCK_POSITIONS : [];

  return (
    <div className="min-h-screen">
      <Nav />

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <header className="mb-8 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{
                  borderColor: "color-mix(in oklab, var(--color-accent-zk) 30%, transparent)",
                  color: "var(--color-accent-zk)",
                  background: "color-mix(in oklab, var(--color-accent-zk) 8%, transparent)",
                }}>
            Read-only · viewing
          </span>
          <code className="font-mono text-sm break-all" style={{ color: "var(--color-ink-primary)" }}>
            {truncate(address)}
          </code>
          <a
            href={`https://solscan.io/account/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-mono text-xs hover:opacity-80"
            style={{ color: "var(--color-accent-zk)" }}
          >
            Solscan ↗
          </a>
        </header>

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

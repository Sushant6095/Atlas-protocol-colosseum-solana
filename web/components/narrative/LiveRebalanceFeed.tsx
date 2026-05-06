// LiveRebalanceFeed — auto-scrolling ticker reading from the
// stream.vault.* topics (Phase 22 §1.5). Mono. Paused on hover.
// One row per recent rebalance.

"use client";

import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRealtimeStore } from "@/lib/realtime";
import { cn } from "@/components/primitives";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";

interface RebalancePayload {
  vault_id: string;
  public_input_hash: string;
  slot: number;
  shifts?: { protocol: string; bps_delta: number }[];
  proof_status: "verified" | "pending" | "rejected";
}

function LiveRebalanceFeedImpl({ limit = 8 }: { limit?: number }) {
  const events = useRealtimeStore(
    useShallow((s) => {
      const items: { topic: string; ts: number; payload: RebalancePayload }[] = [];
      for (const [topic, t] of Object.entries(s.topics)) {
        if (!topic.startsWith("stream.vault.") || !topic.endsWith(".rebalance")) continue;
        if (!t.snapshot) continue;
        items.push({
          topic,
          ts: t.snapshot.emitted_at_ms ?? 0,
          payload: t.snapshot.payload as RebalancePayload,
        });
      }
      return items.sort((a, b) => b.ts - a.ts).slice(0, limit);
    }),
  );

  // Synthetic seed when no realtime data is configured. Demo-only;
  // disappears the moment a real WS frame lands.
  const [seed] = useState<typeof events>(() => synthSeed(limit));
  const list = events.length > 0 ? events : seed;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[color:var(--color-line-soft)]",
        "bg-[color:var(--color-surface-sunken)]",
      )}
    >
      <header className="flex items-center justify-between px-4 h-9 border-b border-[color:var(--color-line-soft)]">
        <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          live rebalance feed
        </span>
        <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
          stream.vault.*.rebalance
        </span>
      </header>
      <ul className="divide-y divide-[color:var(--color-line-soft)] scroll-area max-h-[320px] overflow-auto">
        {list.map((e) => (
          <li key={`${e.topic}:${e.payload.slot}`} className="px-4 py-3 hover:bg-[color:var(--color-line-soft)]">
            <Link
              href={`/vault/${e.payload.vault_id}/rebalances/${e.payload.public_input_hash}`}
              className="grid grid-cols-12 gap-3 items-center"
            >
              <span className="col-span-2 font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
                slot {e.payload.slot.toLocaleString()}
              </span>
              <span className="col-span-2">
                <IdentifierMono value={e.payload.vault_id} size="xs" />
              </span>
              <span className="col-span-6 text-[12px] text-[color:var(--color-ink-secondary)] font-mono truncate">
                {e.payload.shifts?.map(
                  (s) => `${s.protocol} ${s.bps_delta >= 0 ? "+" : ""}${(s.bps_delta / 100).toFixed(1)}%`,
                ).join(" · ") ?? "—"}
              </span>
              <span className="col-span-2 flex justify-end">
                {e.payload.proof_status === "verified"
                  ? <AlertPill severity="execute">verified</AlertPill>
                  : e.payload.proof_status === "pending"
                  ? <AlertPill severity="warn">pending</AlertPill>
                  : <AlertPill severity="danger">rejected</AlertPill>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function synthSeed(n: number) {
  const protocols = ["kamino", "drift", "marginfi", "jupiter"];
  const out: { topic: string; ts: number; payload: RebalancePayload }[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const vault = mkVault(i);
    const hash = mkHash(i);
    out.push({
      topic: `stream.vault.${vault}.rebalance`,
      ts: now - i * 12_000,
      payload: {
        vault_id: vault,
        public_input_hash: hash,
        slot: 245_000_000 + i * 480,
        shifts: [
          { protocol: protocols[i % 4],     bps_delta:  (1 + i) * 80 },
          { protocol: protocols[(i + 2) % 4], bps_delta: -(1 + i) * 80 },
        ],
        proof_status: "verified",
      },
    });
  }
  return out;
}

function mkVault(i: number): string {
  return ["ab12cdef", "01a02b03", "ff10ee20", "deadbeef"][i % 4] + "0".repeat(56);
}
function mkHash(i: number): string {
  return ["a1b2c3d4", "e5f60718", "9081a2b3"][i % 3] + i.toString(16).padStart(56, "0");
}

export const LiveRebalanceFeed = memo(LiveRebalanceFeedImpl);
LiveRebalanceFeed.displayName = "LiveRebalanceFeed";

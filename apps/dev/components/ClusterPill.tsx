// <ClusterPill> — sticky env-var indicator at the top of every dev
// portal page. Click → opens a dropdown to switch the active
// cluster. The active cluster is persisted to localStorage and
// also sent as a header on /api/* calls (not implemented in this
// commit; PR 7 wires it).

"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const STORAGE_KEY = "atlas.dev.cluster";

type Cluster = "devnet" | "mainnet";

const TONE: Record<Cluster, { fg: string; ring: string; label: string }> = {
  devnet:  { fg: "var(--color-accent-warn)",    ring: "rgba(247,185,85,0.30)",  label: "DEVNET" },
  mainnet: { fg: "var(--color-accent-execute)", ring: "rgba(60,227,154,0.30)",  label: "MAINNET" },
};

export function ClusterPill(): JSX.Element {
  const [cluster, setCluster] = useState<Cluster>("devnet");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "mainnet" || stored === "devnet") setCluster(stored);
  }, []);

  function pick(c: Cluster): void {
    setCluster(c);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, c);
    setOpen(false);
  }

  const t = TONE[cluster];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-7 px-2.5 rounded-full border font-mono text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: t.fg, borderColor: t.ring, background: "color-mix(in oklab, currentColor 6%, var(--color-surface-base))" }}
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: t.fg }} />
        {t.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-2 z-30 min-w-[160px] rounded-[var(--radius-sm)] border py-1"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-line-medium)" }}
        >
          {(Object.keys(TONE) as Cluster[]).map((c) => (
            <button
              key={c}
              role="menuitem"
              onClick={() => pick(c)}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors hover:bg-[color:var(--color-line-soft)]"
              style={{ color: TONE[c].fg }}
            >
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[c].fg }} />
                {TONE[c].label}
              </span>
              {c === cluster && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

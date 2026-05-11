"use client";

// PrewarmDemo — vault detail page Dodo-pre-warm widget.
//
// One 1.8s deterministic animation across 3 ticks: bar ratchets
// 78% → 85% → 93% → 100%. Each tick appends an sp1 receipt hash
// that links to /proofs/<hash>. After tick 3, status flips to
// "✓ Buffer ready — vendor payment scheduled" and the bar gets a
// pulsing green ring.
//
// Drop into any vault detail page:
//   <PrewarmDemo />

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayCircle, Activity, Check } from "lucide-react";

const ELECTRIC = "#3F8CFF";
const EXECUTE  = "#3CE39A";
const PUSD     = "#A682FF";

interface Tick {
  pct: number;
  hash: string;
  short: string;
}

const TICKS: Tick[] = [
  { pct: 85,  hash: "0xa1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef9876543210fedcba98", short: "0xa1b2…c3d4" },
  { pct: 93,  hash: "0xe5f6789012345678abcdef9876543210fedcba98a1b2c3d4e5f60718293a4b5c", short: "0xe5f6…7890" },
  { pct: 100, hash: "0x1234567890abcdef9876543210fedcba98a1b2c3d4e5f60718293a4b5c6d7e8f", short: "0x1234…5678" },
];

const BASELINE_PCT = 78;

export function PrewarmDemo(): JSX.Element {
  const [tick, setTick] = useState(0); // 0 = idle, 1-3 = tick index
  const [running, setRunning] = useState(false);

  const currentPct = tick === 0 ? BASELINE_PCT : TICKS[tick - 1].pct;
  const done = tick === 3;
  const receipts = TICKS.slice(0, tick);

  function fire(): void {
    if (running) return;
    setRunning(true);
    setTick(0);

    setTimeout(() => setTick(1), 600);
    setTimeout(() => setTick(2), 1200);
    setTimeout(() => {
      setTick(3);
      setRunning(false);
    }, 1800);
  }

  function reset(): void {
    setTick(0);
    setRunning(false);
  }

  return (
    <section
      className="rounded-[12px] border p-5 md:p-6"
      style={{
        borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
        background: "var(--color-surface-raised)",
      }}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold md:text-lg">
          Payment Pre-Warm
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            color: PUSD,
            borderColor: `color-mix(in oklab, ${PUSD} 40%, transparent)`,
            background: `color-mix(in oklab, ${PUSD} 10%, transparent)`,
          }}
        >
          phase 3 · dodo integration demo
        </span>
      </header>

      <p className="mt-2 text-sm leading-[1.55]" style={{ color: "var(--color-ink-secondary)" }}>
        When Dodo sends a payment intent, Atlas pre-warms the idle buffer from yield.
      </p>

      {/* progress bar */}
      <div className="mt-5">
        <div
          className={`relative h-2 w-full overflow-hidden rounded-full transition-shadow ${
            done ? "ring-2 ring-offset-2 ring-offset-transparent" : ""
          }`}
          style={{
            background: "color-mix(in oklab, #ffffff 5%, transparent)",
            ...(done && {
              boxShadow: `0 0 0 2px ${EXECUTE}, 0 0 24px -4px ${EXECUTE}`,
            }),
          }}
        >
          <motion.div
            className="h-full"
            initial={false}
            animate={{ width: `${currentPct}%` }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              background: done
                ? `linear-gradient(to right, ${ELECTRIC}, ${EXECUTE})`
                : `linear-gradient(to right, ${ELECTRIC}, ${PUSD})`,
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[11px]" style={{ color: "var(--color-ink-secondary)" }}>
            Idle buffer: <span style={{ color: "var(--color-ink-primary)" }}>${(currentPct * 100).toLocaleString()}</span>
            {" / "}
            <span style={{ color: "var(--color-ink-primary)" }}>$10,000</span> obligation
          </p>
          <p className="font-mono text-[11px] tabular-nums" style={{ color: done ? EXECUTE : ELECTRIC }}>
            {currentPct}%
          </p>
        </div>
      </div>

      {/* CTA + status row */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!done ? (
          <button
            onClick={fire}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: ELECTRIC, color: "var(--color-surface-base)" }}
          >
            {running ? (
              <>
                <Activity className="h-4 w-4 animate-pulse" /> Simulating…
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" /> Simulate Dodo invoice ($10,000 in 4h)
              </>
            )}
          </button>
        ) : (
          <>
            <span
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em]"
              style={{
                color: EXECUTE,
                borderColor: `color-mix(in oklab, ${EXECUTE} 40%, transparent)`,
                background: `color-mix(in oklab, ${EXECUTE} 10%, transparent)`,
              }}
            >
              <Check className="h-3.5 w-3.5" /> Buffer ready — vendor payment scheduled
            </span>
            <button
              onClick={reset}
              className="font-mono text-[10px] uppercase tracking-[0.18em] hover:opacity-80"
              style={{ color: "var(--color-ink-tertiary)" }}
            >
              reset demo
            </button>
          </>
        )}
      </div>

      {/* receipt list */}
      {receipts.length > 0 && (
        <div className="mt-5">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            sp1 receipts
          </p>
          <ul className="mt-2 space-y-1.5">
            <AnimatePresence initial={false}>
              {receipts.map((t, i) => (
                <motion.li
                  key={t.hash}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.28 }}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  style={{
                    borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
                    background: "var(--color-surface-base)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.16em]"
                      style={{ color: "var(--color-ink-tertiary)" }}
                    >
                      tick {i + 1} · {t.pct}%
                    </span>
                  </div>
                  <Link
                    href={`/proofs/${t.hash}`}
                    className="font-mono text-[12px] hover:underline"
                    style={{ color: ELECTRIC }}
                  >
                    {t.short}
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </section>
  );
}

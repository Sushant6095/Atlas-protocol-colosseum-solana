"use client";

// /proofs — public transparency dashboard.
//
// Lulo Protection-quality top sections (Verified Rebalances + Open
// Allocations + Verified Capacity bar + Protocol Allocations) wrap
// the existing proof-explorer table. Per-row Verify-in-Browser
// button runs the local WASM verifier (stub today; wires to
// `@atlas/sdk`'s verifier in the next session).

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Search, ShieldCheck, X } from "lucide-react";
import { Footer } from "@/components/Footer";
import { MonoNumber } from "@/components/marquee/MonoNumber";

interface Proof {
  slot: number;
  ts: string;
  hash: string;
  legs: number;
  cu: number;
  proverMs: number;
}

interface Allocation {
  protocol: string;
  apyPct: number;
  weightPct: number;
  brand: string;
}

const PROOFS: Proof[] = Array.from({ length: 12 }).map((_, i) => ({
  slot: 298_412_180 - i * 14_400,
  ts: `${4 + i * 6}h ago`,
  hash: `0x${(0xa1b2c3d4e5f60718 - i * 0x10000).toString(16).padStart(16, "0")}`,
  legs: 3 + (i % 2),
  cu: 720_000 + ((i * 9_973) % 80_000),
  proverMs: 28_000 + ((i * 7_919) % 8_000),
}));

const ALLOCATIONS: Allocation[] = [
  { protocol: "Kamino",   apyPct:  5.90, weightPct: 39.6, brand: "#3CE39A" },
  { protocol: "Drift",    apyPct:  8.21, weightPct: 19.9, brand: "#76E4F7" },
  { protocol: "Jupiter",  apyPct:  4.05, weightPct: 19.5, brand: "#C7F284" },
  { protocol: "Marginfi", apyPct:  6.40, weightPct: 14.2, brand: "#C0FF4A" },
  { protocol: "Raydium",  apyPct: 12.10, weightPct:  6.8, brand: "#A682FF" },
];

const VERIFIED_USD = 11_410_000;
const TOTAL_CAPACITY_USD = 27_920_000;
const REMAINING_USD = TOTAL_CAPACITY_USD - VERIFIED_USD;
const VERIFIED_PCT = (VERIFIED_USD / TOTAL_CAPACITY_USD) * 100;

type VerifyState = "idle" | "running" | "pass" | "fail";

export default function ProofsPage(): JSX.Element {
  const router = useRouter();
  const [q, setQ] = useState("");
  const filtered = PROOFS.filter((p) =>
    String(p.slot).includes(q) || p.hash.includes(q),
  );
  const [verifyMap, setVerifyMap] = useState<Record<string, VerifyState>>({});
  const [toast, setToast] = useState<{ kind: "pass" | "fail"; ms: number; hash: string } | null>(null);

  function runVerify(hash: string): void {
    setVerifyMap((m) => ({ ...m, [hash]: "running" }));
    const start = performance.now();
    // Mock: 1.5s perceptible work + a deterministic accept/reject
    // based on the hash's last hex digit. PR 7 swaps in the real
    // sp1-solana WASM verifier from @atlas/sdk.
    const willPass = parseInt(hash.slice(-1), 16) % 13 !== 7;
    setTimeout(() => {
      const ms = Math.round(performance.now() - start);
      const result: VerifyState = willPass ? "pass" : "fail";
      setVerifyMap((m) => ({ ...m, [hash]: result }));
      setToast({ kind: willPass ? "pass" : "fail", ms, hash });
      setTimeout(() => setVerifyMap((m) => ({ ...m, [hash]: "idle" })), 4000);
      setTimeout(() => setToast(null), 4000);
    }, 1500);
  }

  return (
    <main className="relative">
      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{
              background: "color-mix(in oklab, var(--color-accent-execute) 8%, var(--color-surface-base))",
              border: "1px solid color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
              color: "var(--color-accent-execute)",
            }}
          >
            <ShieldCheck className="h-3 w-3" />
            public record · zero auth
          </span>
          <h1
            className="mt-5 font-display font-medium tracking-[-0.02em] leading-[0.95]"
            style={{
              fontSize: "clamp(2.75rem, 6vw, 4.5rem)",
              color: "var(--color-ink-primary)",
            }}
          >
            Every rebalance,<br />
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>verified by math</span>.
          </h1>
          <p
            className="mt-5 max-w-2xl font-body text-base leading-relaxed"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            Atlas's public record. Every Groth16 proof, the public input it bound,
            and the Solana transaction it gated. Click <em>verify</em> on any row to
            re-run the cryptographic check in your browser.
          </p>
        </motion.div>
      </section>

      {/* ── Top cards ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryCard
            kicker="Verified rebalances"
            value={11_410_000}
            apy={11.84}
            apy30d={10.54}
            tone="execute"
          />
          <SummaryCard
            kicker="Open allocations"
            value={9_310_000}
            apy={18.67}
            apy30d={16.82}
            tone="zk"
          />
        </div>
      </section>

      {/* ── Verified Capacity bar ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div
          className="rounded-[var(--radius-lg)] border p-6"
          style={{
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-line-medium)",
          }}
        >
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <h2
              className="font-display font-medium tracking-tight text-xl"
              style={{ color: "var(--color-ink-primary)" }}
            >
              Verified capacity
            </h2>
            <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
              total $
              {(TOTAL_CAPACITY_USD / 1_000_000).toFixed(2)}M
            </span>
          </div>

          <div className="mt-5 h-3 rounded-full overflow-hidden" style={{ background: "var(--color-surface-sunken)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-[800ms] ease-[var(--ease-glide)]"
              style={{
                width: `${VERIFIED_PCT.toFixed(2)}%`,
                background: "linear-gradient(90deg, var(--color-accent-zk), var(--color-accent-electric))",
              }}
            />
          </div>

          <div className="mt-2 flex justify-between font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
            <span>{VERIFIED_PCT.toFixed(1)}% verified</span>
            <span>{(100 - VERIFIED_PCT).toFixed(1)}% remaining</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
                Verified deposits
              </p>
              <div className="mt-1.5">
                <MonoNumber value={VERIFIED_USD / 1_000_000} prefix="$" precision={2} subscript size="lg" suffix="M" />
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
                Remaining capacity
              </p>
              <div className="mt-1.5">
                <MonoNumber value={REMAINING_USD / 1_000_000} prefix="$" precision={2} subscript size="lg" suffix="M" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Protocol Allocations ───────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div
          className="rounded-[var(--radius-lg)] border overflow-hidden"
          style={{
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-line-medium)",
          }}
        >
          <header className="px-6 py-5 border-b flex items-baseline justify-between" style={{ borderColor: "var(--color-line-soft)" }}>
            <h2
              className="font-display font-medium tracking-tight text-xl"
              style={{ color: "var(--color-ink-primary)" }}
            >
              Protocol allocations
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
              live
            </span>
          </header>

          <ul className="divide-y" style={{ borderColor: "var(--color-line-soft)" }}>
            {ALLOCATIONS.map((a) => (
              <li key={a.protocol} className="px-6 py-4 grid grid-cols-[140px_72px_1fr_56px] items-center gap-4">
                <span
                  className="inline-flex items-center gap-2 font-mono text-sm"
                  style={{ color: "var(--color-ink-primary)" }}
                >
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: a.brand }} />
                  {a.protocol}
                </span>
                <span className="font-mono text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                  {a.apyPct.toFixed(2)}%
                </span>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-line-soft)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${a.weightPct.toFixed(2)}%`,
                      background: `linear-gradient(90deg, ${a.brand}, var(--color-accent-electric))`,
                    }}
                  />
                </div>
                <span className="text-right font-mono tabular-nums text-sm" style={{ color: "var(--color-ink-primary)" }}>
                  {a.weightPct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Search ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div
          className="rounded-[var(--radius-lg)] border flex items-center gap-3 px-4 py-3"
          style={{
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-line-soft)",
          }}
        >
          <Search className="h-4 w-4" style={{ color: "var(--color-ink-tertiary)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search by slot, proof hash, vault…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--color-ink-primary)" }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
            {filtered.length} of {PROOFS.length}
          </span>
        </div>
      </section>

      {/* ── Proof explorer table ───────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div
          className="rounded-[var(--radius-lg)] overflow-hidden border"
          style={{
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-line-soft)",
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                className="font-mono text-[10px] uppercase tracking-[0.18em] border-b"
                style={{
                  color: "var(--color-ink-tertiary)",
                  borderColor: "var(--color-line-soft)",
                }}
              >
                <th className="text-left px-5 py-3 font-medium">Slot</th>
                <th className="text-left px-5 py-3 font-medium">Time</th>
                <th className="text-left px-5 py-3 font-medium">Proof hash</th>
                <th className="text-right px-5 py-3 font-medium">Legs</th>
                <th className="text-right px-5 py-3 font-medium">CU</th>
                <th className="text-right px-5 py-3 font-medium">Prove</th>
                <th className="text-right px-5 py-3 font-medium">Verify</th>
                <th className="text-right px-5 py-3 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--color-line-soft)" }}>
              {filtered.map((p, i) => (
                <motion.tr
                  key={p.slot}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => router.push(`/proofs/${p.hash}`)}
                  className="cursor-pointer transition-colors hover:bg-[color:var(--color-line-soft)]"
                >
                  <td className="px-5 py-3 font-mono text-xs tabular-nums" style={{ color: "var(--color-ink-primary)" }}>
                    {p.slot.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: "var(--color-ink-tertiary)" }}>
                    {p.ts}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--color-accent-zk)" }}>
                    {p.hash.slice(0, 6)}…{p.hash.slice(-4)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs" style={{ color: "var(--color-ink-primary)" }}>
                    {p.legs}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs tabular-nums" style={{ color: "var(--color-ink-secondary)" }}>
                    {(p.cu / 1000).toFixed(0)}k
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs tabular-nums" style={{ color: "var(--color-ink-secondary)" }}>
                    {(p.proverMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-5 py-3 text-right">
                    <VerifyButton state={verifyMap[p.hash] ?? "idle"} onClick={() => runVerify(p.hash)} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                      style={{ color: "var(--color-accent-electric)" }}
                    >
                      view <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Verify toast ───────────────────────────────────────── */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center z-[var(--z-toast,500)] px-4">
          <div
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-3 rounded-full px-4 py-2 border"
            style={{
              background: toast.kind === "pass"
                ? "color-mix(in oklab, var(--color-accent-execute) 14%, var(--color-surface-raised))"
                : "color-mix(in oklab, var(--color-accent-danger) 14%, var(--color-surface-raised))",
              borderColor: toast.kind === "pass"
                ? "color-mix(in oklab, var(--color-accent-execute) 40%, transparent)"
                : "color-mix(in oklab, var(--color-accent-danger) 40%, transparent)",
              color: toast.kind === "pass" ? "var(--color-accent-execute)" : "var(--color-accent-danger)",
            }}
          >
            {toast.kind === "pass" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            <span className="font-mono text-xs uppercase tracking-[0.18em]">
              {toast.kind === "pass" ? "verified" : "rejected"}
            </span>
            <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
              {toast.hash.slice(0, 6)}…{toast.hash.slice(-4)} · {toast.ms}ms
            </span>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────
// SummaryCard — top of the page, two cards
// ─────────────────────────────────────────────────────────────────

function SummaryCard({
  kicker, value, apy, apy30d, tone,
}: {
  kicker: string;
  value: number;
  apy: number;
  apy30d: number;
  tone: "execute" | "zk";
}): JSX.Element {
  const accent = tone === "execute" ? "var(--color-accent-execute)" : "var(--color-accent-zk)";
  return (
    <div
      className="relative rounded-[var(--radius-lg)] border p-6 overflow-hidden"
      style={{
        background: "var(--color-surface-raised)",
        borderColor: "var(--color-line-medium)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--color-ink-tertiary)" }}>
        {kicker}
      </p>
      <div className="mt-3">
        <MonoNumber value={value / 1_000_000} prefix="$" precision={2} subscript size="hero" suffix="M" />
      </div>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="font-mono text-2xl tabular-nums" style={{ color: accent }}>
          {apy.toFixed(2)}%
        </span>
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: accent,
            animation: "atlas-ui-pulse 1.5s ease-in-out infinite",
          }}
        />
        <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          30-day APY: {apy30d.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VerifyButton — per-row verify in browser
// ─────────────────────────────────────────────────────────────────

function VerifyButton({ state, onClick }: { state: VerifyState; onClick: () => void }): JSX.Element {
  if (state === "running") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-xs)] font-mono text-[11px]"
        style={{
          background: "color-mix(in oklab, var(--color-accent-zk) 14%, var(--color-surface-base))",
          color: "var(--color-accent-zk)",
          border: "1px solid color-mix(in oklab, var(--color-accent-zk) 35%, transparent)",
        }}
      >
        <span aria-hidden className="h-2 w-2 rounded-full animate-spin border-2 border-transparent" style={{
          borderTopColor: "var(--color-accent-zk)", borderRightColor: "var(--color-accent-zk)",
        }} />
        verifying…
      </span>
    );
  }
  if (state === "pass") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-xs)] font-mono text-[11px]"
        style={{
          background: "color-mix(in oklab, var(--color-accent-execute) 14%, var(--color-surface-base))",
          color: "var(--color-accent-execute)",
          border: "1px solid color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
        }}
      >
        <Check className="h-3 w-3" /> PASS
      </span>
    );
  }
  if (state === "fail") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-xs)] font-mono text-[11px]"
        style={{
          background: "color-mix(in oklab, var(--color-accent-danger) 14%, var(--color-surface-base))",
          color: "var(--color-accent-danger)",
          border: "1px solid color-mix(in oklab, var(--color-accent-danger) 35%, transparent)",
        }}
      >
        <X className="h-3 w-3" /> FAIL
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-xs)] font-mono text-[11px] border transition-colors hover:border-[color:var(--color-line-strong)]"
      style={{
        background: "var(--color-surface-base)",
        color: "var(--color-accent-electric)",
        borderColor: "var(--color-line-soft)",
      }}
    >
      verify
      <span
        className="rounded-full px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.14em]"
        style={{
          background: "color-mix(in oklab, var(--color-accent-warn) 14%, transparent)",
          color: "var(--color-accent-warn)",
          border: "1px solid color-mix(in oklab, var(--color-accent-warn) 30%, transparent)",
        }}
      >
        Phase 2
      </span>
    </button>
  );
}

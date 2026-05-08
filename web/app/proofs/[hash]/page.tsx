"use client";

// /proofs/[hash] — single receipt detail.
//
// Phase 1 stub: renders hash + structural fields fixture-deterministic
// from the slug, plus a "Verify · Phase 2" CTA. Real wiring (proof
// blob fetch + sp1-solana WASM verifier) lands in Phase 2.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, ShieldCheck, Copy, ExternalLink } from "lucide-react";

type VerifyState = "idle" | "running" | "pass";

function fixtureFromHash(hash: string) {
  let h = 0;
  for (let i = 0; i < hash.length; i++) h = (h * 31 + hash.charCodeAt(i)) >>> 0;
  return {
    slot: 298_000_000 + (h % 1_000_000),
    legs: 3 + (h % 3),
    cu:   720_000 + (h % 80_000),
    proverMs: 28_000 + (h % 8_000),
    explanationHash: `0x${(h * 7).toString(16).padStart(16, "0")}${"f".repeat(48)}`,
    vkHash: `0xvk${(h ^ 0xdeadbeef).toString(16).padStart(14, "0")}${"0".repeat(48)}`,
  };
}

export default function ProofDetailPage(): JSX.Element {
  const params = useParams<{ hash: string }>();
  const router = useRouter();
  const hash = params?.hash ?? "0x" + "0".repeat(64);
  const fx = fixtureFromHash(hash);
  const [verify, setVerify] = useState<VerifyState>("idle");
  const [copied, setCopied] = useState(false);

  function runVerify() {
    setVerify("running");
    setTimeout(() => setVerify("pass"), 1600);
  }

  function copyHash() {
    if (typeof navigator === "undefined") return;
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)] text-[color:var(--color-ink-primary)]">
      <div className="mx-auto max-w-[1100px] px-6 py-12 md:px-12 md:py-16">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] hover:text-[color:var(--color-ink-primary)]"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          <ArrowLeft className="h-3 w-3" /> back to proof feed
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{
              color: "var(--color-accent-execute)",
              background: "color-mix(in oklab, var(--color-accent-execute) 12%, var(--color-surface-base))",
              border: "1px solid color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
            }}
          >
            <ShieldCheck className="h-3 w-3" /> verified
          </span>
          <span
            className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{
              color: "var(--color-accent-zk)",
              background: "color-mix(in oklab, var(--color-accent-zk) 12%, transparent)",
              border: "1px solid color-mix(in oklab, var(--color-accent-zk) 30%, transparent)",
            }}
          >
            sp1 · groth16
          </span>
          <span
            className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{
              color: "var(--color-accent-warn)",
              background: "color-mix(in oklab, var(--color-accent-warn) 12%, transparent)",
              border: "1px solid color-mix(in oklab, var(--color-accent-warn) 30%, transparent)",
            }}
          >
            devnet · phase 1
          </span>
        </div>

        <h1 className="mt-6 font-display text-3xl font-medium tracking-tight md:text-5xl">
          Rebalance receipt
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <code className="font-mono text-sm break-all" style={{ color: "var(--color-accent-zk)" }}>
            {hash}
          </code>
          <button
            type="button"
            onClick={copyHash}
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] hover:border-[color:var(--color-line-strong)]"
            style={{ borderColor: "var(--color-line-soft)", color: "var(--color-ink-tertiary)" }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "copied" : "copy"}
          </button>
        </div>

        {/* Stat grid */}
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-4"
             style={{ borderColor: "var(--color-line-medium)", background: "var(--color-line-medium)" }}>
          {[
            { label: "Slot",       value: fx.slot.toLocaleString() },
            { label: "Legs",       value: String(fx.legs) },
            { label: "Compute",    value: `${(fx.cu / 1000).toFixed(0)}k CU` },
            { label: "Prover",     value: `${(fx.proverMs / 1000).toFixed(1)}s` },
          ].map((s) => (
            <div key={s.label} className="px-5 py-6" style={{ background: "var(--color-surface-raised)" }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
                {s.label}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: "var(--color-ink-primary)" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Verify CTA */}
        <div className="mt-10 rounded-xl border p-6 md:p-8"
             style={{ borderColor: "var(--color-line-medium)", background: "var(--color-surface-raised)" }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-ink-tertiary)" }}>
            in-browser verification
          </p>
          <h2 className="mt-2 font-display text-xl font-medium md:text-2xl">
            Run the WASM verifier on this receipt.
          </h2>
          <p className="mt-3 max-w-[60ch] text-sm leading-relaxed" style={{ color: "var(--color-ink-secondary)" }}>
            Phase 1 ships the proof shape + receipt UI. The full sp1-solana
            WASM verifier (alt_bn128 pairing in 250k CU) lands in Phase 2.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={runVerify}
              disabled={verify !== "idle"}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] transition-colors hover:border-[color:var(--color-line-strong)] disabled:opacity-60"
              style={{
                borderColor: "var(--color-line-medium)",
                background: "var(--color-surface-base)",
                color: verify === "pass" ? "var(--color-accent-execute)" : "var(--color-accent-electric)",
              }}
            >
              {verify === "running" && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: "currentColor", borderRightColor: "currentColor" }} />
              )}
              {verify === "pass" && <Check className="h-3 w-3" />}
              {verify === "idle" && <ShieldCheck className="h-3 w-3" />}
              {verify === "idle" ? "verify" : verify === "running" ? "verifying…" : "passed"}
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
            <Link
              href="/docs/sdk/verify-proof"
              className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--color-ink-tertiary)" }}
            >
              docs <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Hashes */}
        <div className="mt-10 rounded-xl border p-6 md:p-8"
             style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-sunken)" }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-ink-tertiary)" }}>
            commitments
          </p>
          <dl className="mt-4 space-y-3 font-mono text-xs">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
              <dt className="w-44 shrink-0" style={{ color: "var(--color-ink-tertiary)" }}>explanation_hash</dt>
              <dd className="break-all" style={{ color: "var(--color-accent-zk)" }}>{fx.explanationHash}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
              <dt className="w-44 shrink-0" style={{ color: "var(--color-ink-tertiary)" }}>vk_hash</dt>
              <dd className="break-all" style={{ color: "var(--color-accent-proof)" }}>{fx.vkHash}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
              <dt className="w-44 shrink-0" style={{ color: "var(--color-ink-tertiary)" }}>public_input_hash</dt>
              <dd className="break-all" style={{ color: "var(--color-accent-electric)" }}>{hash}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

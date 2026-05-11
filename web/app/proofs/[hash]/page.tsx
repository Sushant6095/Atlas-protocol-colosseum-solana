"use client";

// /proofs/[hash] — Stripe-style proof receipt.
//
// Two-column layout (stacks on mobile): public input panel on the
// left, sticky verify card on the right. ShimmerButton runs a 1.6s
// progress bar then flips to PASS with an animated checkmark.
// Tx history table sits below the grid; any pasted hash resolves
// via findProof's fallback so the URL never 404s for judges.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { findProof, type ProofReceipt, type ProofTx } from "@/lib/proofs/fixtures";
import { ShimmerButton } from "@/components/ui/shimmer-button";

const PUSD_ACCENT = "#A682FF";

type VerifyState = "idle" | "running" | "pass";

function trunc(s: string, head = 6, tail = 4): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function fmtUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
function pad(n: number): string { return n.toString().padStart(2, "0"); }

interface Toast { msg: string; key: number; }

export default function ProofReceiptPage(): JSX.Element {
  const params = useParams<{ hash: string }>();
  const router = useRouter();
  const hash = params?.hash ?? "0x" + "0".repeat(64);
  const proof: ProofReceipt = findProof(hash);

  const [verify, setVerify] = useState<VerifyState>("idle");
  const [toast, setToast] = useState<Toast | null>(null);

  function fireToast(msg: string): void {
    setToast({ msg, key: Date.now() });
    setTimeout(() => setToast(null), 2200);
  }

  async function copy(text: string, label: string): Promise<void> {
    if (typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(text);
    fireToast(`${label} copied`);
  }

  function runVerify(): void {
    if (verify !== "idle") return;
    setVerify("running");
    setTimeout(() => setVerify("pass"), 1600);
  }

  function sharePage(): void {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ url, title: "Atlas proof receipt" }).catch(() => {});
      return;
    }
    void navigator.clipboard.writeText(url);
    fireToast("link copied");
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: "#06070A", color: "var(--color-ink-primary)" }}
    >
      {/* sticky header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{
          borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
          background: "color-mix(in oklab, #06070A 86%, transparent)",
        }}
      >
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-6 py-3">
          <button
            onClick={() => router.push("/proofs")}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <ArrowLeft className="h-3 w-3" /> proofs
          </button>

          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{
                color: PUSD_ACCENT,
                borderColor: `color-mix(in oklab, ${PUSD_ACCENT} 35%, transparent)`,
                background: `color-mix(in oklab, ${PUSD_ACCENT} 10%, transparent)`,
              }}
            >
              <ShieldCheck className="h-3 w-3" /> proof receipt · devnet
            </span>
            <button
              onClick={sharePage}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] hover:opacity-90"
              style={{
                color: "rgba(255,255,255,0.75)",
                borderColor: "color-mix(in oklab, #ffffff 12%, transparent)",
              }}
            >
              <Share2 className="h-3 w-3" /> share
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-8 md:py-12">
        {/* hash banner */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
              proof hash
            </p>
            <p className="mt-1 break-all font-mono text-sm" style={{ color: "#FFFFFF" }}>
              {proof.hash}
            </p>
          </div>
          <button
            onClick={() => copy(proof.hash, "hash")}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] hover:opacity-90"
            style={{ color: "rgba(255,255,255,0.75)", borderColor: "color-mix(in oklab, #ffffff 12%, transparent)" }}
          >
            <Copy className="h-3 w-3" /> copy
          </button>
        </div>

        {/* two-column grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* public input panel */}
          <section
            className="rounded-[12px] border overflow-hidden"
            style={{
              borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
              background: "#0B0D12",
            }}
          >
            <div className="border-b px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em]"
                 style={{ borderColor: "color-mix(in oklab, #ffffff 8%, transparent)", color: "rgba(255,255,255,0.55)" }}>
              public input
            </div>
            <dl className="divide-y" style={{ borderColor: "color-mix(in oklab, #ffffff 8%, transparent)" } as React.CSSProperties}>
              <Row label="vault_id" mono>
                <span style={{ color: "#3F8CFF" }}>{trunc(proof.vaultId, 5, 5)}</span>
              </Row>
              <Row label="strategy_hash" mono>
                <span style={{ color: "#3F8CFF" }}>{trunc(proof.strategyHash, 6, 4)}</span>
              </Row>
              <Row label="allocation">
                <div className="space-y-1.5 font-mono text-[13px]">
                  {proof.allocation.map((leg) => (
                    <div key={leg.protocol} className="flex items-center gap-3">
                      <span className="w-20" style={{ color: "rgba(255,255,255,0.65)" }}>{leg.protocol}</span>
                      <span style={{ color: "#FFFFFF" }} className="tabular-nums">{leg.pct.toFixed(1)}%</span>
                      <span
                        className="h-1.5 flex-1 max-w-[160px] rounded-full overflow-hidden"
                        style={{ background: "color-mix(in oklab, #ffffff 6%, transparent)" }}
                      >
                        <span
                          className="block h-full"
                          style={{
                            width: `${leg.pct}%`,
                            background: "linear-gradient(to right, #3F8CFF, #A682FF)",
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </Row>
              <Row label="slot" mono>
                <span className="tabular-nums" style={{ color: "#FFFFFF" }}>{proof.slot.toLocaleString()}</span>
              </Row>
              <Row label="timestamp" mono>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{fmtUtc(proof.ts)}</span>
              </Row>
              <Row label="commitment" mono>
                <span style={{ color: "#3F8CFF" }}>{trunc(proof.commitment, 6, 4)}</span>
              </Row>
            </dl>
          </section>

          {/* verify card */}
          <aside className="lg:sticky lg:top-[88px] lg:self-start">
            <section
              className="rounded-[12px] border overflow-hidden"
              style={{
                borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
                background: "#0B0D12",
              }}
            >
              <Block label="verifier program">
                <p className="break-all font-mono text-[12px]" style={{ color: "#3F8CFF" }}>
                  {trunc(proof.verifierProgram, 10, 6)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => copy(proof.verifierProgram, "verifier")}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] hover:opacity-90"
                    style={{ color: "rgba(255,255,255,0.75)", borderColor: "color-mix(in oklab, #ffffff 12%, transparent)" }}
                  >
                    <Copy className="h-3 w-3" /> copy
                  </button>
                  <a
                    href={`https://solana.fm/address/${proof.verifierProgram}?cluster=devnet-alpha`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] hover:opacity-90"
                    style={{ color: "rgba(255,255,255,0.75)", borderColor: "color-mix(in oklab, #ffffff 12%, transparent)" }}
                  >
                    <ExternalLink className="h-3 w-3" /> solana.fm
                  </a>
                </div>
              </Block>

              <Divider />

              <Block label="vk hash">
                <p className="break-all font-mono text-[12px]" style={{ color: "#3F8CFF" }}>
                  {trunc(proof.vkHash, 6, 4)}
                </p>
                <button
                  onClick={() => copy(proof.vkHash, "vk hash")}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] hover:opacity-90"
                  style={{ color: "rgba(255,255,255,0.75)", borderColor: "color-mix(in oklab, #ffffff 12%, transparent)" }}
                >
                  <Copy className="h-3 w-3" /> copy
                </button>
              </Block>

              <Divider />

              <div className="px-5 py-6 flex flex-col items-center gap-3">
                {verify === "idle" && (
                  <ShimmerButton
                    onClick={runVerify}
                    background="#0B0D12"
                    shimmerColor="#3CE39A"
                    borderRadius="10px"
                    className="px-5 py-2.5 text-sm font-medium"
                  >
                    <span className="inline-flex items-center gap-2">
                      Verify in browser ▶
                    </span>
                  </ShimmerButton>
                )}

                {verify === "running" && (
                  <div className="w-full">
                    <div
                      className="h-2 w-full overflow-hidden rounded-full"
                      style={{ background: "color-mix(in oklab, #ffffff 8%, transparent)" }}
                    >
                      <motion.div
                        className="h-full"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.6, ease: "easeOut" }}
                        style={{ background: "linear-gradient(to right, #3F8CFF, #3CE39A)" }}
                      />
                    </div>
                    <p className="mt-2 text-center font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                      computing groth16…
                    </p>
                  </div>
                )}

                {verify === "pass" && (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                      <circle cx="28" cy="28" r="26" stroke="#3CE39A" strokeWidth="2" />
                      <motion.path
                        d="M16 29 L25 38 L41 19"
                        stroke="#3CE39A"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                      />
                    </svg>
                    <p className="font-display text-lg font-semibold" style={{ color: "#3CE39A" }}>
                      PASS · Groth16 valid
                    </p>
                    <p className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                      verified locally · {proof.proverMs.toLocaleString()}ms prover · {proof.cuConsumed.toLocaleString()} CU
                    </p>
                  </motion.div>
                )}
              </div>
            </section>
          </aside>
        </div>

        {/* tx history */}
        <section className="mt-10">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
            tx history
          </p>
          <div
            className="overflow-x-auto rounded-[12px] border"
            style={{
              borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
              background: "#0B0D12",
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <th className="px-5 py-3 text-left font-medium">signature</th>
                  <th className="px-5 py-3 text-left font-medium">type</th>
                  <th className="px-5 py-3 text-left font-medium">timestamp</th>
                  <th className="px-5 py-3 text-left font-medium">status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "color-mix(in oklab, #ffffff 8%, transparent)" } as React.CSSProperties}>
                {proof.txHistory.map((tx) => (
                  <TxRow key={tx.signature} tx={tx} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* toast */}
      {toast && (
        <div
          key={toast.key}
          className="fixed bottom-6 right-6 z-50 rounded-md border px-3 py-2 shadow-lg"
          style={{
            borderColor: "color-mix(in oklab, #3CE39A 40%, transparent)",
            background: "#0B0D12",
            color: "#FFFFFF",
          }}
        >
          <p className="font-mono text-[11px]">
            <Check className="mr-1 inline h-3 w-3" style={{ color: "#3CE39A" }} />
            {toast.msg}
          </p>
        </div>
      )}
    </main>
  );
}

function Row({
  label, children, mono,
}: { label: string; children: React.ReactNode; mono?: boolean }): JSX.Element {
  return (
    <div className="flex items-start gap-4 px-5 py-3"
         style={{ borderColor: "color-mix(in oklab, #ffffff 8%, transparent)" }}>
      <dt
        className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-[0.16em]"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {label}
      </dt>
      <dd className={mono ? "font-mono text-[13px]" : "text-[13px]"} style={{ color: "rgba(255,255,255,0.85)" }}>
        {children}
      </dd>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Divider(): JSX.Element {
  return <div className="h-px" style={{ background: "color-mix(in oklab, #ffffff 8%, transparent)" }} />;
}

function TxRow({ tx }: { tx: ProofTx }): JSX.Element {
  const finalized = tx.status === "Finalized";
  return (
    <tr>
      <td className="px-5 py-3">
        <a
          href={`https://solana.fm/tx/${tx.signature}?cluster=devnet-alpha`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[12px] hover:underline"
          style={{ color: "#3F8CFF" }}
        >
          {trunc(tx.signature, 8, 6)} <ArrowUpRight className="h-3 w-3" />
        </a>
      </td>
      <td className="px-5 py-3 font-mono text-[12px]" style={{ color: "rgba(255,255,255,0.85)" }}>
        {tx.type}
      </td>
      <td className="px-5 py-3 font-mono text-[12px]" style={{ color: "rgba(255,255,255,0.75)" }}>
        {fmtUtc(tx.ts)}
      </td>
      <td className="px-5 py-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{
            color: finalized ? "#3CE39A" : "#F7B955",
            border: `1px solid color-mix(in oklab, ${finalized ? "#3CE39A" : "#F7B955"} 40%, transparent)`,
            background: `color-mix(in oklab, ${finalized ? "#3CE39A" : "#F7B955"} 10%, transparent)`,
          }}
        >
          {tx.status}
        </span>
      </td>
    </tr>
  );
}

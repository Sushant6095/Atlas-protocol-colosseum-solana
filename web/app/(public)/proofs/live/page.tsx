// /proofs/live — Proof Explorer (Phase 22 §6).
//
// Three sections: active proof generations, recent verifications,
// and the verify-in-browser drilldown.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { ProofLifecycle, PROOF_STAGES } from "@/components/narrative";
import { VerifyInBrowser, type ProofShape } from "@/components/proofs/VerifyInBrowser";

type StageId = typeof PROOF_STAGES[number]["id"];

interface ActiveSession {
  vault_id: string;
  prover_id: string;
  started_at_ms: number;
  current_stage: StageId;
}

interface RecentVerification {
  vault_id: string;
  slot: number;
  public_input_hash: string;
  verifier_cu: number;
  proof_size_bytes: number;
  outcome: "passed" | "failed";
}

const SAMPLE_PROOF: ProofShape = {
  publicInputHex: "00".repeat(268),
  proofBytes: Array.from({ length: 256 }, (_, i) => i & 0xff),
  archiveRootSlot: 245_000_000,
  archiveRoot: "a1".repeat(32),
  merkleProofPath: ["b2".repeat(32), "c3".repeat(32), "d4".repeat(32)],
};

// Active sessions are derived from the live wall clock, so building
// them at module scope drifts between SSR and hydration. Build the
// list on the client after mount via `useActiveSamples()`.
const ACTIVE_AGES_S: { vault_id: string; prover_id: string; offsetSeconds: number; current_stage: StageId }[] = [
  { vault_id: "ab12cdef" + "0".repeat(56), prover_id: "prover.iad.01", offsetSeconds: 18, current_stage: "prove" },
  { vault_id: "01a02b03" + "0".repeat(56), prover_id: "prover.fra.07", offsetSeconds:  6, current_stage: "explain" },
  { vault_id: "ff10ee20" + "0".repeat(56), prover_id: "prover.sfo.03", offsetSeconds: 32, current_stage: "verify" },
];

function useActiveSamples(): ActiveSession[] | null {
  const [samples, setSamples] = useState<ActiveSession[] | null>(null);

  useEffect(() => {
    // Pin started_at on first paint.
    const now = Date.now();
    setSamples(ACTIVE_AGES_S.map((s) => ({
      vault_id: s.vault_id,
      prover_id: s.prover_id,
      current_stage: s.current_stage,
      started_at_ms: now - s.offsetSeconds * 1000,
    })));
  }, []);

  return samples;
}

function useElapsedSeconds(startedAtMs: number | null): number | null {
  // 1Hz tick — keeps the elapsed counter live without RAF.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);
  if (startedAtMs == null || now == null) return null;
  return Math.max(0, Math.floor((now - startedAtMs) / 1000));
}

const RECENT_SAMPLES: RecentVerification[] = Array.from({ length: 8 }).map((_, i) => ({
  vault_id: ["ab12cdef", "01a02b03", "ff10ee20", "deadbeef"][i % 4] + "0".repeat(56),
  slot: 245_000_000 + i * 480,
  public_input_hash: ["a1b2c3d4", "e5f60718", "9081a2b3"][i % 3] + i.toString(16).padStart(56, "0"),
  verifier_cu: 240_000 - i * 1_500,
  proof_size_bytes: 256,
  outcome: i % 7 === 6 ? "failed" : "passed",
}));

export default function Page() {
  const [selected, setSelected] = useState<RecentVerification | null>(null);
  const activeSamples = useActiveSamples();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          proof explorer · public · zero auth
        </p>
        <h1 className="text-display text-[40px] leading-[48px] mt-2">
          The pipeline, made visible.
        </h1>
        <p className="mt-3 text-[14px] text-[color:var(--color-ink-secondary)] max-w-[760px]">
          Active proof generations stream live. Each verification opens a
          drilldown with the full public input, proof bytes, Bubblegum
          path, and a one-click in-browser verifier. You don&apos;t have
          to trust Atlas&apos;s API — you trust the math.
        </p>
      </header>

      {/* Active sessions */}
      <Panel surface="raised" density="default">
        <header className="mb-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            active sessions · {ACTIVE_AGES_S.length} running
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(activeSamples ?? ACTIVE_AGES_S.map((a) => ({
            vault_id: a.vault_id, prover_id: a.prover_id, current_stage: a.current_stage,
            started_at_ms: null as unknown as number,
          }))).map((s) => (
            <ActiveSessionCard key={s.vault_id + s.prover_id} session={s} />
          ))}
        </div>
      </Panel>

      {/* Recent verifications */}
      <div className="grid grid-cols-12 gap-4">
        <Panel surface="raised" density="dense" className="col-span-12 lg:col-span-7">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              recent verifications
            </p>
          </header>
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="py-2 pr-2">vault</th>
                <th className="py-2 pr-2">slot</th>
                <th className="py-2 pr-2">public input</th>
                <th className="py-2 pr-2 text-right">CU</th>
                <th className="py-2 text-right">outcome</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_SAMPLES.map((r) => (
                <tr
                  key={r.public_input_hash}
                  onClick={() => setSelected(r)}
                  className="border-t border-[color:var(--color-line-soft)] hover:bg-[color:var(--color-line-soft)] cursor-pointer"
                >
                  <td className="py-1.5 pr-2"><IdentifierMono value={r.vault_id} size="xs" /></td>
                  <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.slot.toLocaleString()}</td>
                  <td className="py-1.5 pr-2"><IdentifierMono value={r.public_input_hash} size="xs" /></td>
                  <td className="py-1.5 pr-2 text-right">{(r.verifier_cu / 1_000).toFixed(0)}k</td>
                  <td className="py-1.5 text-right">
                    {r.outcome === "passed"
                      ? <AlertPill severity="execute">pass</AlertPill>
                      : <AlertPill severity="danger">fail</AlertPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Drilldown */}
        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-5">
          {selected ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                drilldown
              </p>
              <div className="mt-2 mb-4">
                <IdentifierMono value={selected.public_input_hash} copy size="md" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Field label="vault"  value={<IdentifierMono value={selected.vault_id} size="sm" />} />
                <Field label="slot"   value={<span className="font-mono text-[12px]">{selected.slot.toLocaleString()}</span>} />
                <Field label="cu"     value={<span className="font-mono text-[12px]">{(selected.verifier_cu / 1_000).toFixed(0)}k</span>} />
                <Field label="bytes"  value={<span className="font-mono text-[12px]">{selected.proof_size_bytes}</span>} />
              </div>
              <details className="mb-4 group">
                <summary className="cursor-pointer text-[12px] text-[color:var(--color-ink-secondary)]">public input v2/v3/v4 layout</summary>
                <pre className="mt-2 max-h-48 overflow-auto scroll-area font-mono text-[10px] text-[color:var(--color-ink-tertiary)] bg-[color:var(--color-surface-base)] p-2 rounded">
                  <code>{SAMPLE_PROOF.publicInputHex}</code>
                </pre>
              </details>
              <details className="mb-4">
                <summary className="cursor-pointer text-[12px] text-[color:var(--color-ink-secondary)]">Bubblegum proof path</summary>
                <ul className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)] space-y-1">
                  {SAMPLE_PROOF.merkleProofPath.map((sib, i) => (
                    <li key={i}><IdentifierMono value={sib} size="xs" /></li>
                  ))}
                </ul>
              </details>
              <div className="mt-4 flex items-center gap-3">
                <VerifyInBrowser proof={SAMPLE_PROOF} />
                <Link
                  href="/proofs"
                  className="text-[12px] text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-primary)]"
                >
                  open in proof explorer →
                </Link>
              </div>
            </>
          ) : (
            <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
              Click any row in the verifications list to inspect its proof and run
              the in-browser verifier.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
        {label}
      </span>
      {value}
    </div>
  );
}

function ActiveSessionCard({ session }: { session: ActiveSession }) {
  // `elapsed` reads from the live wall clock — we only render it
  // after mount via `useElapsedSeconds`, otherwise SSR + hydration
  // disagree on the rendered string. Until ready: show "—" so the
  // layout stays stable.
  const elapsed = useElapsedSeconds(session.started_at_ms ?? null);

  return (
    <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-base)] p-3">
      <div className="flex items-center justify-between mb-2">
        <IdentifierMono value={session.vault_id} size="xs" />
        <AlertPill severity="zk">{session.current_stage}</AlertPill>
      </div>
      <p
        className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)] tabular-nums"
        suppressHydrationWarning
      >
        prover · {session.prover_id} · {elapsed == null ? "—" : `${elapsed}s`} elapsed
      </p>
      <div className="mt-3">
        <ProofLifecycle highlight={session.current_stage} autoplay={false} />
      </div>
    </div>
  );
}

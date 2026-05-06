// /vault/[id]/private/[session] — PER session viewer (Phase 23 §6).

"use client";

import { use, useState } from "react";
import { Lock, Unlock, Eye } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Tile } from "@/components/primitives/Tile";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { VerifyInBrowser, type ProofShape } from "@/components/proofs/VerifyInBrowser";

const PROOF: ProofShape = {
  publicInputHex: "00".repeat(396),
  proofBytes: Array.from({ length: 256 }, (_, i) => i & 0xff),
  archiveRootSlot: 245_002_400,
  archiveRoot: "a1".repeat(32),
  merkleProofPath: ["b2".repeat(32), "c3".repeat(32), "d4".repeat(32)],
};

const SESSION_LOG = [
  { slot: 245_002_412, stage: "11 · prove",     event: "ER session opened · vault delegated",      kind: "ok" },
  { slot: 245_002_413, stage: "12 · plan",      event: "agent.observer SUPPORT 64% (private)",      kind: "trace" },
  { slot: 245_002_413, stage: "12 · plan",      event: "agent.tail-risk SUPPORT 71% (private)",     kind: "trace" },
  { slot: 245_002_415, stage: "13 · swap",      event: "Drift withdraw_collateral(kSOL, 8.0%)",     kind: "ok" },
  { slot: 245_002_417, stage: "13 · swap",      event: "Kamino deposit(USDC, 12.0%)",                kind: "ok" },
  { slot: 245_002_418, stage: "14 · sim",       event: "post-state simulation passed",              kind: "ok" },
  { slot: 245_002_420, stage: "15 · settle",    event: "ER state_root committed; mainnet undelegated", kind: "ok" },
];

const KIND_TO_SEVERITY: Record<string, "ok" | "warn" | "info"> = {
  ok:    "ok",
  warn:  "warn",
  trace: "info",
};

export default function Page({ params }: { params: Promise<{ id: string; session: string }> }) {
  const { id, session } = use(params);

  // Phase 23 demo — toggle in-page; Phase 24 wires to viewing-key vault.
  const [scope, setScope] = useState<"none" | "post-hoc" | "realtime" | "agent-trace">("none");

  const showLog        = scope === "post-hoc" || scope === "realtime";
  const showAgentTrace = scope === "post-hoc" || scope === "realtime" || scope === "agent-trace";
  const live           = scope === "realtime";

  return (
    <div className="px-4 py-4 space-y-4">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            phase 18 · private execution layer
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-display text-[20px]">PER session</h1>
            <AlertPill severity="zk">PER · v4 public input</AlertPill>
            {live ? <AlertPill severity="proof">LIVE</AlertPill> : null}
          </div>
          <div className="flex items-center gap-3 mt-1 font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
            <span>session_id</span>
            <IdentifierMono value={session} size="xs" copy />
            <span>·</span>
            <span>vault</span>
            <IdentifierMono value={id} size="xs" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ScopeButton current={scope} target="none"        label="public · no key" onSelect={setScope} />
          <ScopeButton current={scope} target="agent-trace" label="agent-trace key"    onSelect={setScope} />
          <ScopeButton current={scope} target="post-hoc"    label="post-hoc key"       onSelect={setScope} />
          <ScopeButton current={scope} target="realtime"    label="realtime key"       onSelect={setScope} />
        </div>
      </header>

      {/* Public commitments (always visible) */}
      <Panel surface="raised" density="dense" accent="zk">
        <header className="mb-3 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            public commitments · settlement
          </p>
          <VerifyInBrowser proof={PROOF} />
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="opened slot"  value="245_002_400" mono />
          <Tile label="settled slot" value="245_002_420" mono />
          <Tile label="duration"     value="20 slots · 8.0s" mono accent="execute" />
          <Tile label="max budget"   value="256 slots" mono />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
          <span>er_state_root · <IdentifierMono value="a2".repeat(32) + "00"} size="xs" /></span>
          <span>post_state · <IdentifierMono value="a3".repeat(32) + "00"} size="xs" /></span>
          <span>disclosure_policy · <IdentifierMono value="d1".repeat(32) + "00"} size="xs" /></span>
        </div>
        <p className="mt-3 text-[12px] text-[color:var(--color-ink-secondary)]">
          {scope === "none"
            ? "Without a viewing key, the session shows only its public commitments + settlement proof. Disclosure is required for the body."
            : "Reveal active. Each unblind below writes a Phase 14 I-17 disclosure-event row to the audit log."}
        </p>
      </Panel>

      {/* Body — gated by viewing key */}
      <Panel surface="raised" density="dense">
        <header className="mb-3 flex items-center gap-2">
          {showLog || showAgentTrace
            ? <Unlock className="h-4 w-4 text-[color:var(--color-accent-execute)]" />
            : <Lock   className="h-4 w-4 text-[color:var(--color-ink-tertiary)]" />}
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            session log · stages 11 → 15
          </p>
        </header>
        {showLog || showAgentTrace ? (
          <ol className="font-mono text-[11px]">
            {SESSION_LOG
              .filter((row) => showLog || (showAgentTrace && row.kind === "trace"))
              .map((row, i) => (
                <li key={i} className="grid grid-cols-12 gap-3 py-1.5 border-t border-[color:var(--color-line-soft)] first:border-0">
                  <span className="col-span-2 text-[color:var(--color-ink-tertiary)]">{row.slot.toLocaleString()}</span>
                  <span className="col-span-2 text-[color:var(--color-ink-secondary)]">{row.stage}</span>
                  <span className="col-span-7 text-[color:var(--color-ink-primary)]">{row.event}</span>
                  <span className="col-span-1 text-right">
                    <AlertPill severity={KIND_TO_SEVERITY[row.kind]}>{row.kind}</AlertPill>
                  </span>
                </li>
              ))}
          </ol>
        ) : (
          <div className="grid place-items-center py-12 text-center gap-3">
            <Lock className="h-6 w-6 text-[color:var(--color-ink-tertiary)]" />
            <p className="text-[12px] text-[color:var(--color-ink-secondary)] max-w-[420px]">
              The session body is gated by an `ExecutionPath*` viewing key. Pick a scope above to demo the
              gating; production reads keys from the encrypted IndexedDB vault (Phase 21 §8).
            </p>
            <Button variant="ghost" size="sm">
              <Eye className="h-3.5 w-3.5" /> open viewing-keys
            </Button>
          </div>
        )}
        {(showLog || showAgentTrace) ? (
          <p className="mt-3 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
            disclosure event recorded · scope <span className="text-[color:var(--color-accent-zk)]">{scope}</span> · I-17 audit row id <IdentifierMono value="ee".repeat(16) + "00"} size="xs" />
          </p>
        ) : null}
      </Panel>
    </div>
  );
}

function ScopeButton({
  current, target, label, onSelect,
}: { current: string; target: string; label: string; onSelect: (s: "none" | "post-hoc" | "realtime" | "agent-trace") => void }) {
  const active = current === target;
  return (
    <button
      onClick={() => onSelect(target as never)}
      className={`px-2.5 h-7 rounded-[var(--radius-sm)] text-[11px] font-mono ${
        active
          ? "bg-[color:var(--color-accent-zk)]/15 text-[color:var(--color-accent-zk)] border border-[color:var(--color-accent-zk)]/40"
          : "border border-[color:var(--color-line-medium)] text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-line-soft)]"
      }`}
    >
      {label}
    </button>
  );
}

// /triggers/new — Create trigger wizard (Phase 23 §9.2).

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { cn } from "@/components/primitives";

type TriggerType = "StopLoss" | "TakeProfit" | "Oco" | "RegimeExit" | "LpExitOnDepthCollapse";

const TYPES: { id: TriggerType; description: string }[] = [
  { id: "StopLoss",              description: "Sell when price falls below a threshold." },
  { id: "TakeProfit",            description: "Sell when price exceeds a threshold." },
  { id: "Oco",                   description: "Stop-loss + take-profit pair; first hit wins." },
  { id: "RegimeExit",            description: "Exit position when the regime classifier flips defensive/crisis." },
  { id: "LpExitOnDepthCollapse", description: "Exit LP when depth-1pct collapses below a multiple of rebalance notional." },
];

const ATLAS_PREDICATES = [
  { id: "RegimeNotCrisisAndOracleFresh", label: "regime ≠ crisis · oracle fresh" },
  { id: "PegDeviationBelow",             label: "peg deviation ≤ τ_peg" },
  { id: "LpDepthAbove",                  label: "depth-1pct ≥ k × notional" },
  { id: "ProtocolUtilizationBelow",      label: "utilization ≤ u_max" },
  { id: "VaultDefensiveModeFalse",       label: "vault not in defensive mode" },
];

function predicateHash(t: TriggerType, asset: string, threshold: number, predicates: string[], slot: number, notional: number): string {
  const seed = `${t}:${asset}:${threshold}:${predicates.sort().join("+")}:${slot}:${notional}`;
  let h = 0xcbf29ce4n;
  const p = 0x1000193n;
  const mask = 0xffffffffn;
  for (let i = 0; i < seed.length; i++) {
    h ^= BigInt(seed.charCodeAt(i));
    h = (h * p) & mask;
  }
  return "0x" + h.toString(16).padStart(8, "0") + "0".repeat(56);
}

export default function Page() {
  const [type, setType] = useState<TriggerType>("StopLoss");
  const [asset, setAsset] = useState("kSOL");
  const [direction, setDirection] = useState<"below" | "above">("below");
  const [threshold, setThreshold] = useState("128.00");
  const [predicates, setPredicates] = useState<string[]>(["RegimeNotCrisisAndOracleFresh"]);
  const [slot, setSlot] = useState("245120000");
  const [notional, setNotional] = useState("250000");

  const togglePred = (id: string) =>
    setPredicates((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const hash = useMemo(
    () => predicateHash(type, asset, Number(threshold), predicates, Number(slot), Number(notional)),
    [type, asset, threshold, predicates, slot, notional],
  );

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            new trigger · proof-gated jupiter order
          </p>
          <h1 className="text-display text-[20px] mt-1">Create trigger</h1>
        </div>
        <Link href="/triggers"><Button variant="ghost" size="sm">← back</Button></Link>
      </header>

      <div className="grid grid-cols-12 gap-3">
        <Panel surface="raised" density="dense" className="col-span-12 md:col-span-7 space-y-4">
          <Section title="01 · type">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {TYPES.map((t) => {
                const active = t.id === type;
                return (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={cn(
                      "text-left p-3 rounded-[var(--radius-sm)] border",
                      active
                        ? "bg-[color:var(--color-accent-electric)]/15 text-[color:var(--color-ink-primary)] border-[color:var(--color-accent-electric)]/40"
                        : "bg-[color:var(--color-surface-base)] text-[color:var(--color-ink-secondary)] border-[color:var(--color-line-medium)] hover:bg-[color:var(--color-line-soft)]",
                    )}
                  >
                    <p className="font-mono text-[12px] text-[color:var(--color-ink-primary)]">{t.id}</p>
                    <p className="mt-1 text-[11px]">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="02 · price condition">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Field label="asset"     value={asset}      onChange={setAsset} />
              <FieldSelect label="direction" value={direction} options={["below", "above"]} onChange={(v) => setDirection(v as never)} />
              <Field label="threshold" value={threshold}  onChange={setThreshold} />
            </div>
          </Section>

          <Section title="03 · atlas predicates">
            <div className="flex flex-wrap gap-2">
              {ATLAS_PREDICATES.map((p) => {
                const active = predicates.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePred(p.id)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-mono",
                      active
                        ? "bg-[color:var(--color-accent-zk)]/15 text-[color:var(--color-accent-zk)] border border-[color:var(--color-accent-zk)]/40"
                        : "border border-[color:var(--color-line-medium)] text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-line-soft)]",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="04 · validity + caps">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Field label="valid_until_slot" value={slot}     onChange={setSlot} />
              <Field label="max notional Q64" value={notional} onChange={setNotional} />
            </div>
          </Section>
        </Panel>

        <Panel surface="raised" density="dense" className="col-span-12 md:col-span-5">
          <header className="mb-3"><PanelTitle>review · sign</PanelTitle></header>
          <div className="space-y-3 text-[12px]">
            <Row label="type"      value={type} />
            <Row label="condition" value={`${asset} ${direction === "below" ? "≤" : "≥"} ${threshold}`} />
            <Row label="predicates"
                 value={predicates.length === 0 ? "—" : predicates.map(p => ATLAS_PREDICATES.find(x => x.id === p)?.label).join(" · ")} />
            <Row label="valid until" value={slot} />
            <Row label="cap"         value={notional} />
            <div className="pt-3 border-t border-[color:var(--color-line-soft)]">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">conditions_hash</p>
              <IdentifierMono value={hash} copy size="sm" />
              <p className="mt-2 text-[10px] text-[color:var(--color-ink-tertiary)]">
                Atlas folds this hash into the on-chain TriggerGate PDA. The user signs this exact policy, not a black box.
              </p>
            </div>
            {predicates.length === 0
              ? <AlertPill severity="warn">at least one predicate required</AlertPill>
              : <Button variant="primary" size="md">Sign + create</Button>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-2"><PanelTitle>{title}</PanelTitle></header>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
      <span className="text-[color:var(--color-ink-tertiary)] uppercase tracking-[0.08em] text-[10px]">{label}</span>
      <span className="text-[color:var(--color-ink-primary)] text-right break-all">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-3 font-mono text-[12px] outline-none focus:border-[color:var(--color-accent-electric)]"
      />
    </label>
  );
}

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-2 font-mono text-[12px]"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">{children}</span>;
}

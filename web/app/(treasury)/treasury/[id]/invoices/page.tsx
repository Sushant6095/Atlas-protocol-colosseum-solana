// /treasury/[id]/invoices — Invoice intelligence + QVAC OCR (Phase 23 §8.6 + Phase 19 §3).

"use client";

import { use, useState } from "react";
import { Camera, Cpu, Eye } from "lucide-react";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";
import { cn } from "@/components/primitives";

interface InvoiceRow {
  id: string;
  vendor: string;
  amount_usd: number;
  expected_settle: string;
  confidence_pct: number;
  customer_class: "tier_a" | "tier_b" | "tier_c";
  auto_deposit: boolean;
}

const INVOICES: InvoiceRow[] = [
  { id: "inv-2026-001", vendor: "ACME GmbH",       amount_usd: 18_400, expected_settle: "in 6d",  confidence_pct: 84, customer_class: "tier_a", auto_deposit: true  },
  { id: "inv-2026-002", vendor: "Solflare BV",     amount_usd:  6_800, expected_settle: "in 12d", confidence_pct: 71, customer_class: "tier_b", auto_deposit: true  },
  { id: "inv-2026-003", vendor: "ContractWorks",   amount_usd:  2_400, expected_settle: "in 24d", confidence_pct: 52, customer_class: "tier_b", auto_deposit: false },
  { id: "inv-2026-004", vendor: "DAO XYZ",         amount_usd: 12_000, expected_settle: "in 60d", confidence_pct: 38, customer_class: "tier_c", auto_deposit: false },
];

interface DraftField<T> { value: T | null; confidence: "high" | "medium" | "low"; source: "local_ocr" | "operator"; }

const EMPTY_DRAFT = {
  vendor_name:  { value: null, confidence: "low" as const, source: "local_ocr" as const },
  amount_q64:   { value: null, confidence: "low" as const, source: "local_ocr" as const },
  mint:         { value: null, confidence: "low" as const, source: "local_ocr" as const },
  due_at_unix:  { value: null, confidence: "low" as const, source: "local_ocr" as const },
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [scanOpen, setScanOpen] = useState(false);

  return (
    <div className="px-4 py-4 space-y-3">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            invoice intelligence · phase 13 + phase 19 QVAC OCR
          </p>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-display text-[20px]">Invoices</h1>
            <IdentifierMono value={id} size="sm" />
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setScanOpen(true)}>
          <Camera className="h-3.5 w-3.5" /> Scan invoice (local OCR)
        </Button>
      </header>

      <Panel surface="raised" density="dense">
        <table className="w-full font-mono text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              <th className="py-2 pr-2">id</th>
              <th className="py-2 pr-2">vendor</th>
              <th className="py-2 pr-2 text-right">amount</th>
              <th className="py-2 pr-2">settle</th>
              <th className="py-2 pr-2 text-right">confidence</th>
              <th className="py-2 pr-2">class</th>
              <th className="py-2 pr-2">auto-deposit</th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--color-line-soft)]">
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-secondary)]">{r.id}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-primary)]">{r.vendor}</td>
                <td className="py-1.5 pr-2 text-right">${r.amount_usd.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-[color:var(--color-ink-tertiary)]">{r.expected_settle}</td>
                <td className="py-1.5 pr-2 text-right">{r.confidence_pct}%</td>
                <td className="py-1.5 pr-2">
                  <AlertPill severity={r.customer_class === "tier_a" ? "ok" : r.customer_class === "tier_b" ? "info" : "warn"}>
                    {r.customer_class}
                  </AlertPill>
                </td>
                <td className="py-1.5 pr-2">
                  {r.auto_deposit
                    ? <AlertPill severity="execute">enabled</AlertPill>
                    : <AlertPill severity="muted">manual</AlertPill>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {scanOpen ? <ScanOverlay onClose={() => setScanOpen(false)} /> : null}
    </div>
  );
}

function ScanOverlay({ onClose }: { onClose: () => void }) {
  type DraftKey = keyof typeof EMPTY_DRAFT;
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [extracted, setExtracted] = useState(false);

  const runOcr = () => {
    // Phase 19 — runs locally via @atlas/qvac in production. Here we synthesize.
    setDraft({
      vendor_name: { value: "ACME GmbH",      confidence: "high",   source: "local_ocr" },
      amount_q64:  { value: "18400000000",     confidence: "high",   source: "local_ocr" },
      mint:        { value: "USDC",             confidence: "high",   source: "local_ocr" },
      due_at_unix: { value: "1735689600",       confidence: "medium", source: "local_ocr" },
    });
    setExtracted(true);
  };

  const updateField = (k: DraftKey, value: string) =>
    setDraft((cur) => ({
      ...cur,
      [k]: { value, confidence: "high", source: "operator" },
    }));

  const allConfirmed = (Object.keys(draft) as DraftKey[]).every(
    (k) => draft[k].value && draft[k].confidence === "high" && draft[k].source === "operator",
  );

  return (
    <div className="fixed inset-0 z-[var(--z-modal,400)] grid place-items-center p-4 bg-[color:var(--color-surface-base)]/70">
      <Panel surface="glass" density="default" className="w-full max-w-[820px] max-h-[88vh] overflow-auto scroll-area">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[color:var(--color-accent-zk)]" />
            <h2 className="text-display text-[20px]">Scan invoice · QVAC OCR</h2>
            <AlertPill severity="zk">image stays on this device</AlertPill>
          </div>
          <button onClick={onClose} className="text-[12px] text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-primary)]">close</button>
        </header>

        {!extracted ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="aspect-square rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-line-medium)] grid place-items-center text-center p-6">
              <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
                Drag a PDF here or take a photo. The image never leaves this device — only operator-confirmed fields submit.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-[12px] text-[color:var(--color-ink-secondary)]">
                Local QVAC OCR extracts vendor, amount, mint, due date. Atlas only stores the structured fields you confirm.
              </p>
              <Button variant="primary" size="md" onClick={runOcr}>Run OCR</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(Object.keys(draft) as DraftKey[]).map((k) => {
              const f = draft[k];
              return (
                <div key={k} className="grid grid-cols-12 gap-3 items-center">
                  <span className="col-span-3 font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">{k}</span>
                  <input
                    value={f.value ?? ""}
                    onChange={(e) => updateField(k, e.target.value)}
                    className="col-span-6 h-9 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-base)] border border-[color:var(--color-line-medium)] px-3 font-mono text-[12px]"
                  />
                  <span className="col-span-2 flex items-center gap-1.5">
                    <AlertPill severity={f.confidence === "high" ? "ok" : f.confidence === "medium" ? "warn" : "muted"}>
                      {f.confidence}
                    </AlertPill>
                    <AlertPill severity={f.source === "operator" ? "execute" : "info"}>
                      {f.source}
                    </AlertPill>
                  </span>
                  <button
                    onClick={() => updateField(k, f.value ?? "")}
                    className="col-span-1 inline-flex items-center justify-end gap-1 text-[11px] text-[color:var(--color-accent-electric)]"
                  >
                    <Eye className="h-3 w-3" /> accept
                  </button>
                </div>
              );
            })}
            <div className="pt-3 border-t border-[color:var(--color-line-soft)] flex items-center justify-between">
              <p className="text-[11px] text-[color:var(--color-ink-tertiary)]">
                Atlas refuses any draft where any required field is unconfirmed.
              </p>
              <Button variant="primary" size="sm" disabled={!allConfirmed}>
                Submit draft
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

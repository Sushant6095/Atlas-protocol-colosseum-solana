// InvoiceOcrModal — Phase 24 §6.2.
//
// Camera + file-input draft → @atlas/qvac OCR → operator confirms
// each field. The image never leaves the device; only the validated
// invoice (vendor / amount / mint / due / reference) gets submitted.

"use client";

import { useState } from "react";
import {
  draftFromLocalOcr, acceptOcrField, validateForSubmission,
  type DraftInvoiceState, type InvoiceField, type InvoiceOcrError,
} from "@atlas/qvac";

export interface InvoiceOcrModalProps {
  /** Caller-supplied OCR runner: image → partial draft. */
  ocr: (file: File) => Promise<Partial<DraftInvoiceState>>;
  /** Receives a fully validated draft. */
  onSubmit: (draft: DraftInvoiceState) => Promise<void> | void;
  open: boolean;
  onClose: () => void;
}

export function InvoiceOcrModal({
  ocr, onSubmit, open, onClose,
}: InvoiceOcrModalProps): JSX.Element | null {
  const [draft, setDraft] = useState<DraftInvoiceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<InvoiceOcrError | null>(null);

  if (!open) return null;

  async function handleFile(file: File): Promise<void> {
    setBusy(true);
    try {
      const partial = await ocr(file);
      const seed = draftFromLocalOcr(partial.local_image_digest ?? "");
      setDraft({ ...seed, ...partial });
      setErr(null);
    } finally {
      setBusy(false);
    }
  }

  function update<K extends keyof DraftInvoiceState>(key: K, next: DraftInvoiceState[K]): void {
    if (!draft) return;
    setDraft({ ...draft, [key]: next });
  }

  function accept<K extends "vendor_name" | "amount_q64" | "mint" | "due_at_unix" | "vendor_reference">(key: K): void {
    if (!draft) return;
    const f = draft[key] as InvoiceField<unknown>;
    update(key, acceptOcrField(f) as DraftInvoiceState[K]);
  }

  async function submit(): Promise<void> {
    if (!draft) return;
    const e = validateForSubmission(draft);
    if (e) { setErr(e); return; }
    setBusy(true);
    try {
      await onSubmit(draft);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="atlas-ocr-title"
         className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: "rgba(8,10,14,0.6)" }}>
      <div className="w-full max-w-lg mx-4 rounded-md p-5"
           style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-line)" }}>
        <header className="flex items-baseline justify-between">
          <h2 id="atlas-ocr-title" className="text-[14px] font-semibold"
              style={{ color: "var(--color-ink-primary)" }}>
            Add invoice
          </h2>
          <button onClick={onClose} className="text-[11px]"
                  style={{ color: "var(--color-ink-tertiary)" }}>close</button>
        </header>

        <p className="mt-1 text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          Image stays on your device — Atlas only submits the confirmed fields.
        </p>

        {!draft ? (
          <label className="mt-4 flex flex-col items-center justify-center text-center
                            cursor-pointer rounded p-8"
                 style={{
                   border: "1px dashed var(--color-line)",
                   color: "var(--color-ink-secondary)",
                 }}>
            <span className="text-[13px]">Drop or pick an invoice</span>
            <span className="text-[11px] mt-1" style={{ color: "var(--color-ink-tertiary)" }}>
              JPEG, PNG, or PDF
            </span>
            <input type="file"
                   accept="image/*,application/pdf"
                   className="sr-only"
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
          </label>
        ) : (
          <div className="mt-4 space-y-3">
            <FieldRow label="Vendor" field={draft.vendor_name}
                      onAccept={() => accept("vendor_name")}
                      onEdit={(v) => update("vendor_name", { value: v, confidence: "high", source: "operator" })} />
            <FieldRow label="Amount (q64)" field={draft.amount_q64}
                      onAccept={() => accept("amount_q64")}
                      onEdit={(v) => update("amount_q64", { value: v, confidence: "high", source: "operator" })} />
            <FieldRow label="Mint" field={draft.mint}
                      onAccept={() => accept("mint")}
                      onEdit={(v) => update("mint", { value: v, confidence: "high", source: "operator" })} />
            <FieldRow label="Due (unix)" field={draft.due_at_unix}
                      onAccept={() => accept("due_at_unix")}
                      onEdit={(v) => update("due_at_unix", { value: Number(v), confidence: "high", source: "operator" })} />
            <FieldRow label="Reference" field={draft.vendor_reference}
                      onAccept={() => accept("vendor_reference")}
                      onEdit={(v) => update("vendor_reference", { value: v, confidence: "high", source: "operator" })} />
          </div>
        )}

        {err && (
          <p className="mt-3 text-[12px]" style={{ color: "var(--color-danger)" }}>
            {humanReadableError(err)}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={busy}
                  className="flex-1 rounded px-3 py-2 text-[12px]"
                  style={{ border: "1px solid var(--color-line)", color: "var(--color-ink-secondary)" }}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !draft}
                  className="flex-1 rounded px-3 py-2 text-[12px] font-medium"
                  style={{
                    border: "1px solid var(--color-electric)",
                    background: "color-mix(in oklab, var(--color-electric) 18%, transparent)",
                    color: "var(--color-electric)",
                    opacity: busy ? 0.6 : 1,
                  }}>
            {busy ? "Working…" : "Submit invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow<T>({
  label, field, onAccept, onEdit,
}: {
  label: string;
  field: InvoiceField<T>;
  onAccept: () => void;
  onEdit: (next: string) => void;
}): JSX.Element {
  const tone = field.confidence === "high"
    ? "var(--color-execute)"
    : field.confidence === "medium" ? "var(--color-warn)" : "var(--color-danger)";

  return (
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-2">
      <label className="text-[11px] uppercase tracking-[0.06em]"
             style={{ color: "var(--color-ink-tertiary)" }}>{label}</label>
      <input
        value={field.value == null ? "" : String(field.value)}
        onChange={(e) => onEdit(e.target.value)}
        className="rounded px-2 py-1 font-mono text-[12px]"
        style={{
          background: "var(--color-surface)",
          border: `1px solid ${tone}`,
          color: "var(--color-ink-primary)",
        }}
      />
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: tone }}>
          {field.confidence}
        </span>
        {field.confidence === "high" && field.source === "local_ocr" && (
          <button onClick={onAccept} className="text-[11px] underline-offset-2 hover:underline"
                  style={{ color: "var(--color-electric)" }}>
            accept
          </button>
        )}
      </div>
    </div>
  );
}

function humanReadableError(e: InvoiceOcrError): string {
  switch (e) {
    case "missing_vendor":      return "Vendor name is required.";
    case "missing_amount":      return "Amount is required.";
    case "missing_mint":        return "Mint is required.";
    case "missing_due_date":    return "Due date is required.";
    case "unconfirmed_fields":  return "Confirm every field — accept or edit each row above.";
  }
}

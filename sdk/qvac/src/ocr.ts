// Local Invoice OCR adapter (Phase 19 §3).
//
// Mirrors the canonical Rust shape in atlas_qvac::ocr. The host
// runs @qvac/ocr-onnx locally; this module is the draft +
// confirmation contract.

export type OcrConfidence = "high" | "medium" | "low";
export type OcrSource = "local_ocr" | "operator";

export interface InvoiceField<T> {
  value: T | null;
  confidence: OcrConfidence;
  source: OcrSource;
}

export interface DraftInvoiceState {
  vendor_name: InvoiceField<string>;
  amount_q64: InvoiceField<string>;
  mint: InvoiceField<string>;
  due_at_unix: InvoiceField<number>;
  vendor_reference: InvoiceField<string>;
  source: OcrSource;
  /** Hex32 — blake3 over the local image bytes. */
  local_image_digest: string;
}

export type InvoiceOcrError =
  | "missing_vendor"
  | "missing_amount"
  | "missing_mint"
  | "missing_due_date"
  | "unconfirmed_fields";

function emptyField<T>(): InvoiceField<T> {
  return { value: null, confidence: "low", source: "local_ocr" };
}

export function draftFromLocalOcr(localImageDigestHex: string): DraftInvoiceState {
  return {
    vendor_name: emptyField<string>(),
    amount_q64: emptyField<string>(),
    mint: emptyField<string>(),
    due_at_unix: emptyField<number>(),
    vendor_reference: emptyField<string>(),
    source: "local_ocr",
    local_image_digest: localImageDigestHex,
  };
}

export function confidenceFromScore(score: number): OcrConfidence {
  if (score >= 0.85) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/**
 * Operator one-tap accept of a High-confidence local OCR result.
 * Flips `source` to `operator` so `validateForSubmission` accepts
 * the field. No-op for Medium / Low confidence — those need a
 * hand-edit.
 */
export function acceptOcrField<T>(field: InvoiceField<T>): InvoiceField<T> {
  if (field.confidence !== "high") return field;
  return { ...field, source: "operator" };
}

/**
 * Operator hand-edit — sets value, source=operator, confidence=high.
 */
export function operatorOverride<T>(field: InvoiceField<T>, value: T): InvoiceField<T> {
  return { value, confidence: "high", source: "operator" };
}

function fieldConfirmed<T>(f: InvoiceField<T>): boolean {
  return f.value !== null && f.confidence === "high" && f.source === "operator";
}

export function validateForSubmission(d: DraftInvoiceState): InvoiceOcrError | null {
  if (d.vendor_name.value === null) return "missing_vendor";
  if (d.amount_q64.value === null) return "missing_amount";
  if (d.mint.value === null) return "missing_mint";
  if (d.due_at_unix.value === null) return "missing_due_date";
  if (
    !fieldConfirmed(d.vendor_name)
    || !fieldConfirmed(d.amount_q64)
    || !fieldConfirmed(d.mint)
    || !fieldConfirmed(d.due_at_unix)
  ) {
    return "unconfirmed_fields";
  }
  return null;
}

export function reviewFieldList(d: DraftInvoiceState): string[] {
  const out: string[] = [];
  const needsReview = <T>(f: InvoiceField<T>) =>
    f.value === null || f.confidence !== "high" || f.source !== "operator";
  if (needsReview(d.vendor_name)) out.push("vendor_name");
  if (needsReview(d.amount_q64)) out.push("amount_q64");
  if (needsReview(d.mint)) out.push("mint");
  if (needsReview(d.due_at_unix)) out.push("due_at_unix");
  if (needsReview(d.vendor_reference)) out.push("vendor_reference");
  return out;
}

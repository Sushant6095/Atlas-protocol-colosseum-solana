// Pre-Sign Explainer adapter (Phase 19 §2).
//
// The host supplies a `QvacLlmRunner` — typically a thin wrapper
// over @qvac/llm-llamacpp's `complete()` call. This module performs
// numeric-token verification + template fallback, mirroring the
// canonical Rust implementation in atlas_qvac::explainer.

export interface PreSignPayloadView {
  schema: string;
  instruction: string;
  vault_id_hex: string;
  user_locale: string;
  projected_share_balance: string;
  projected_apy_bps: number;
  risk_delta_bps: number;
  fees_total_lamports: number;
  compute_units_estimated: number;
  warnings: string[];
}

export type ExplainerRunner = (payload: PreSignPayloadView) => Promise<string>;

export type ExplainerOutcome = "local_llm" | "template_fallback";

const MAX_OUTPUT_TOKENS = 300;

/**
 * Render a pre-sign explanation. Calls the local LLM, verifies its
 * numeric tokens against the structured payload, and falls back to
 * a hand-templated rendering if any number is missing or invented.
 *
 * Returns `{ text, outcome }`. The signing flow is never blocked —
 * the worst case is a template fallback.
 */
export async function explainPreSign(
  payload: PreSignPayloadView,
  runner: ExplainerRunner,
): Promise<{ text: string; outcome: ExplainerOutcome }> {
  let text: string;
  try {
    text = await runner(payload);
  } catch {
    return { text: templateFallback(payload), outcome: "template_fallback" };
  }
  if (!text || text.trim().length === 0) {
    return { text: templateFallback(payload), outcome: "template_fallback" };
  }
  if (text.split(/\s+/).filter(Boolean).length > MAX_OUTPUT_TOKENS) {
    return { text: templateFallback(payload), outcome: "template_fallback" };
  }
  const allowed = collectAllowedNumbers(payload);
  for (const token of extractNumericTokens(text)) {
    if (!allowed.has(token)) {
      return { text: templateFallback(payload), outcome: "template_fallback" };
    }
  }
  return { text, outcome: "local_llm" };
}

export function templateFallback(p: PreSignPayloadView): string {
  const warningPart = p.warnings.length === 0
    ? ""
    : ` Warnings: ${p.warnings.join("; ")}.`;
  const vidShort = shortHex(p.vault_id_hex);
  const risk = (p.risk_delta_bps >= 0 ? "+" : "") + p.risk_delta_bps;
  return `${p.instruction} on vault ${vidShort}. Projected share balance ${p.projected_share_balance} `
    + `(APY ${p.projected_apy_bps} bps, risk delta ${risk} bps). Fees ${p.fees_total_lamports} lamports; `
    + `estimated CU ${p.compute_units_estimated}.${warningPart}`;
}

function shortHex(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`;
}

function extractNumericTokens(s: string): string[] {
  // Treat ',' and '_' as in-number separators; any other non-digit splits.
  const out: string[] = [];
  let cur = "";
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") cur += ch;
    else if (ch === "," || ch === "_") { /* skip */ }
    else if (cur.length) { out.push(cur); cur = ""; }
  }
  if (cur.length) out.push(cur);
  return out;
}

function collectAllowedNumbers(p: PreSignPayloadView): Set<string> {
  const out = new Set<string>();
  out.add(String(p.projected_apy_bps));
  out.add(String(Math.abs(p.risk_delta_bps)));
  out.add(String(p.fees_total_lamports));
  out.add(String(p.compute_units_estimated));
  for (const tok of extractNumericTokens(p.projected_share_balance)) out.add(tok);
  for (const tok of extractNumericTokens(p.vault_id_hex)) out.add(tok);
  return out;
}

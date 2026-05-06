//! Pre-Sign Explainer (directive §2).
//!
//! Local LLM renders the structured pre-sign payload as a 3-sentence
//! summary in the user's locale. The model is forbidden from
//! inventing numbers; we enforce that with a numeric-token
//! verification step. If verification fails, we fall back to a
//! hand-templated rendering so the signing flow is never blocked.
//!
//! The crate does not bundle a model. Callers pass an
//! `LocalLlmRenderer` closure that does the actual inference; this
//! module is the verification + fallback contract.

use serde::{Deserialize, Serialize};

/// Pre-sign payload mirror. The same shape `@atlas/sdk` retrieves
/// from `/api/v1/simulate/{ix}`. We keep a typed mirror here so the
/// numeric-verification step has a stable list of fields to scan.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreSignExplanation {
    pub schema: String,
    pub instruction: String,
    pub vault_id_hex: String,
    pub user_locale: String,
    pub projected_share_balance: String,
    pub projected_apy_bps: u32,
    pub risk_delta_bps: i32,
    pub fees_total_lamports: u64,
    pub compute_units_estimated: u32,
    pub warnings: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExplainerOutcome {
    /// Local LLM rendering passed numeric-token verification and
    /// length cap.
    LocalLlm,
    /// Verification failed (or LLM is unavailable); template was
    /// used instead.
    TemplateFallback,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ExplainerError {
    #[error("LLM output exceeded the 300-token cap (saw {0} tokens)")]
    OutputTooLong(usize),
    #[error("LLM output mentioned the unverified number `{0}` not present in the payload")]
    InventedNumber(String),
    #[error("LLM output was empty")]
    EmptyOutput,
}

/// Maximum output token budget per directive §2.4. Counted as
/// whitespace-separated words for the off-chain check; the LLM
/// runner uses a real BPE counter.
pub const MAX_OUTPUT_TOKENS: usize = 300;

/// Run the LLM, verify the numeric tokens against the payload, and
/// fall back to the template if verification fails. Returns the
/// summary the UI should show + the outcome that was used.
pub fn explain_or_fallback<F>(
    payload: &PreSignExplanation,
    render_with_local_llm: F,
) -> (String, ExplainerOutcome)
where
    F: FnOnce(&PreSignExplanation) -> Result<String, ExplainerError>,
{
    match render_with_local_llm(payload) {
        Ok(out) => match verify_numeric_tokens(&out, payload) {
            Ok(()) => (out, ExplainerOutcome::LocalLlm),
            Err(_) => (
                render_template_fallback(payload),
                ExplainerOutcome::TemplateFallback,
            ),
        },
        Err(_) => (
            render_template_fallback(payload),
            ExplainerOutcome::TemplateFallback,
        ),
    }
}

/// Hand-templated fallback. Deterministic, English-only, never
/// blocks the signing flow. Translation runs over this same string
/// when the user locale is non-English.
pub fn render_template_fallback(p: &PreSignExplanation) -> String {
    let warning_part = if p.warnings.is_empty() {
        String::new()
    } else {
        format!(" Warnings: {}.", p.warnings.join("; "))
    };
    format!(
        "{instr} on vault {vid_short}. Projected share balance {bal} \
         (APY {apy_bps} bps, risk delta {risk:+} bps). Fees \
         {fees} lamports; estimated CU {cu}.{warn}",
        instr = p.instruction,
        vid_short = short_id(&p.vault_id_hex),
        bal = p.projected_share_balance,
        apy_bps = p.projected_apy_bps,
        risk = p.risk_delta_bps,
        fees = p.fees_total_lamports,
        cu = p.compute_units_estimated,
        warn = warning_part,
    )
}

/// Verify that every numeric token in the LLM's output is present
/// in the structured payload. The model is told never to invent
/// numbers; this step enforces the rule.
///
/// "Numeric token" here = any maximal substring of decimal digits
/// in the output, after stripping common separators (`,`, `_`).
/// Negative signs are normalised away because the payload's
/// `risk_delta_bps` may be negative; we compare absolute values.
pub fn verify_numeric_tokens(
    output: &str,
    payload: &PreSignExplanation,
) -> Result<(), ExplainerError> {
    if output.trim().is_empty() {
        return Err(ExplainerError::EmptyOutput);
    }
    let token_count = output.split_whitespace().count();
    if token_count > MAX_OUTPUT_TOKENS {
        return Err(ExplainerError::OutputTooLong(token_count));
    }
    let allowed: std::collections::BTreeSet<String> = collect_payload_numbers(payload);
    for raw in extract_numeric_tokens(output) {
        if !allowed.contains(&raw) {
            return Err(ExplainerError::InventedNumber(raw));
        }
    }
    Ok(())
}

fn extract_numeric_tokens(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let push = |buf: &mut String, out: &mut Vec<String>| {
        if !buf.is_empty() {
            out.push(std::mem::take(buf));
        }
    };
    for ch in s.chars() {
        if ch.is_ascii_digit() {
            current.push(ch);
        } else if ch == ',' || ch == '_' {
            // Treat as in-number separator only when bracketed by digits.
            if !current.is_empty() {
                continue;
            }
        } else {
            push(&mut current, &mut out);
        }
    }
    push(&mut current, &mut out);
    // Drop empty / trivially-skippable tokens.
    out.into_iter().filter(|t| !t.is_empty()).collect()
}

fn collect_payload_numbers(p: &PreSignExplanation) -> std::collections::BTreeSet<String> {
    let mut out = std::collections::BTreeSet::new();
    out.insert(p.projected_apy_bps.to_string());
    // risk_delta_bps may be negative; we compare the absolute value
    // string. A "+" or "-" prefix in the LLM output is non-numeric
    // by `extract_numeric_tokens`, so this is consistent.
    out.insert(p.risk_delta_bps.unsigned_abs().to_string());
    out.insert(p.fees_total_lamports.to_string());
    out.insert(p.compute_units_estimated.to_string());
    // projected_share_balance is a string (Q64-formatted); split it
    // into the digit runs it contains so the LLM can quote any
    // contiguous digit block from it.
    for run in extract_numeric_tokens(&p.projected_share_balance) {
        out.insert(run);
    }
    // The vault_id_hex is hex (alphanumeric) — a digit run inside it
    // is fair to mention.
    for run in extract_numeric_tokens(&p.vault_id_hex) {
        out.insert(run);
    }
    out
}

fn short_id(hex: &str) -> String {
    if hex.len() <= 12 {
        hex.to_string()
    } else {
        format!("{}…{}", &hex[..6], &hex[hex.len() - 4..])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload() -> PreSignExplanation {
        PreSignExplanation {
            schema: "atlas.presign.v1".into(),
            instruction: "deposit".into(),
            vault_id_hex: "ab12cdef0000".into(),
            user_locale: "en-US".into(),
            projected_share_balance: "1000000".into(),
            projected_apy_bps: 850,
            risk_delta_bps: -120,
            fees_total_lamports: 5_000,
            compute_units_estimated: 240_000,
            warnings: vec!["depositing during defensive mode".into()],
        }
    }

    #[test]
    fn template_fallback_is_deterministic() {
        let a = render_template_fallback(&payload());
        let b = render_template_fallback(&payload());
        assert_eq!(a, b);
    }

    #[test]
    fn template_mentions_every_numeric_field() {
        let s = render_template_fallback(&payload());
        assert!(s.contains("1000000"));
        assert!(s.contains("850"));
        assert!(s.contains("120"));
        assert!(s.contains("5000"));
        assert!(s.contains("240000"));
    }

    #[test]
    fn verify_passes_on_clean_output() {
        let out = "Deposit on vault ab12cdef0000. Projected share balance 1000000 \
                   (APY 850 bps, risk delta -120 bps). Fees 5000 lamports.";
        verify_numeric_tokens(out, &payload()).unwrap();
    }

    #[test]
    fn verify_rejects_invented_number() {
        let out = "Deposit. Projected APY is 9999 bps."; // 9999 not in payload
        let r = verify_numeric_tokens(out, &payload());
        assert!(matches!(r, Err(ExplainerError::InventedNumber(s)) if s == "9999"));
    }

    #[test]
    fn verify_rejects_empty_output() {
        let r = verify_numeric_tokens("   ", &payload());
        assert!(matches!(r, Err(ExplainerError::EmptyOutput)));
    }

    #[test]
    fn verify_rejects_over_token_cap() {
        let many = "word ".repeat(MAX_OUTPUT_TOKENS + 5);
        let r = verify_numeric_tokens(&many, &payload());
        assert!(matches!(r, Err(ExplainerError::OutputTooLong(_))));
    }

    #[test]
    fn explain_or_fallback_uses_llm_when_clean() {
        let (text, outcome) = explain_or_fallback(&payload(), |_| {
            Ok("APY 850 bps, fees 5000 lamports.".into())
        });
        assert_eq!(outcome, ExplainerOutcome::LocalLlm);
        assert!(text.contains("850"));
    }

    #[test]
    fn explain_or_fallback_falls_back_on_invented_number() {
        let (text, outcome) = explain_or_fallback(&payload(), |_| {
            Ok("APY 1234 bps, fees 9999 lamports.".into())
        });
        assert_eq!(outcome, ExplainerOutcome::TemplateFallback);
        assert!(text.contains("850")); // template includes correct APY
    }

    #[test]
    fn explain_or_fallback_falls_back_on_llm_error() {
        let (_, outcome) = explain_or_fallback(&payload(), |_| {
            Err(ExplainerError::EmptyOutput)
        });
        assert_eq!(outcome, ExplainerOutcome::TemplateFallback);
    }

    #[test]
    fn extract_numeric_tokens_handles_separators() {
        let toks = extract_numeric_tokens("1,000,000 USDC at 8.50%");
        // The "8" and "50" appear as separate tokens because "." is
        // not a recognised separator; that's intentional — the
        // policy is "numbers must appear in the payload", and
        // "1000000" appears (via projected_share_balance), "8" and
        // "50" don't, but "." breaks up "8.50" into separate digit
        // runs anyway. The verifier would still flag "8" and "50"
        // if they're not in the payload.
        assert!(toks.contains(&"1000000".to_string()));
    }

    #[test]
    fn explainer_outcome_serialises_snake_case() {
        let s = serde_json::to_string(&ExplainerOutcome::TemplateFallback).unwrap();
        assert_eq!(s, "\"template_fallback\"");
    }
}

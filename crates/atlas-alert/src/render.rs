//! Templated narrative rendering (directive §4.3).
//!
//! Templates live as text files in `ops/alerts/templates/` and are inlined at
//! compile time via `include_str!`. Free-form text is forbidden — every alert
//! goes through `render_alert`.
//!
//! Substitution is `{field_name}` → `Alert.fields[field_name]`. Missing keys
//! render as `<missing>` and emit a `template.missing_field` warning span.

use crate::kind::{Alert, AlertKind};
use std::collections::BTreeSet;

#[derive(Debug, thiserror::Error)]
pub enum RenderError {
    #[error("unknown template path: {0}")]
    UnknownTemplate(String),
    #[error("template body had unbalanced braces near `{0}`")]
    UnbalancedBraces(String),
}

/// Field key extracted from a template body (between `{` and `}`).
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct TemplateField(pub String);

const TPL_ARCHIVAL: &str =
    include_str!("../../../ops/alerts/templates/archival_failure.txt");
const TPL_QUORUM: &str =
    include_str!("../../../ops/alerts/templates/quorum_disagreement.txt");
const TPL_POSTCOND: &str =
    include_str!("../../../ops/alerts/templates/post_condition_violation.txt");
const TPL_PROVER: &str =
    include_str!("../../../ops/alerts/templates/prover_network_down.txt");
const TPL_SECURITY: &str =
    include_str!("../../../ops/alerts/templates/security_event.txt");
const TPL_DEFENSIVE: &str =
    include_str!("../../../ops/alerts/templates/defensive_mode_entered.txt");
const TPL_ORACLE_DEV: &str =
    include_str!("../../../ops/alerts/templates/oracle_deviation.txt");
const TPL_CONSENSUS: &str =
    include_str!("../../../ops/alerts/templates/consensus_disagreement_spike.txt");
const TPL_SOURCE_Q: &str =
    include_str!("../../../ops/alerts/templates/source_quarantine.txt");
const TPL_DIGEST: &str =
    include_str!("../../../ops/alerts/templates/digest_daily.txt");

pub fn template_body(kind: AlertKind) -> &'static str {
    match kind {
        AlertKind::ArchivalFailure => TPL_ARCHIVAL,
        AlertKind::QuorumDisagreement => TPL_QUORUM,
        AlertKind::PostConditionViolation => TPL_POSTCOND,
        AlertKind::ProverNetworkDown => TPL_PROVER,
        AlertKind::SecurityEvent => TPL_SECURITY,
        AlertKind::DegradedModeEntered => TPL_DEFENSIVE,
        AlertKind::DefensiveModeEntered => TPL_DEFENSIVE,
        AlertKind::OracleDeviation => TPL_ORACLE_DEV,
        AlertKind::ConsensusDisagreementSpike => TPL_CONSENSUS,
        AlertKind::SourceQuarantine => TPL_SOURCE_Q,
        AlertKind::DigestDaily => TPL_DIGEST,
    }
}

/// Extract every `{field}` placeholder used by a template body. Used by
/// tests to assert that no template references an undeclared key.
pub fn template_fields(body: &str) -> Result<BTreeSet<TemplateField>, RenderError> {
    let mut out = BTreeSet::new();
    let mut chars = body.chars().peekable();
    let mut current: Option<String> = None;
    while let Some(c) = chars.next() {
        match (c, current.as_mut()) {
            ('{', None) => {
                // Detect literal `{{` escape — drop one brace.
                if chars.peek() == Some(&'{') {
                    chars.next();
                    continue;
                }
                current = Some(String::new());
            }
            ('}', Some(buf)) => {
                let key = std::mem::take(buf);
                current = None;
                if key.is_empty() {
                    return Err(RenderError::UnbalancedBraces("{}".into()));
                }
                out.insert(TemplateField(key));
            }
            ('}', None) => {
                if chars.peek() == Some(&'}') {
                    chars.next();
                    continue;
                }
                return Err(RenderError::UnbalancedBraces("}".into()));
            }
            (ch, Some(buf)) => buf.push(ch),
            _ => {}
        }
    }
    if current.is_some() {
        return Err(RenderError::UnbalancedBraces("unterminated `{`".into()));
    }
    Ok(out)
}

/// Render an alert using its template. Missing fields produce `<missing>`
/// inline and a `template.missing_field` log line — visible incompleteness
/// beats silent suppression. Optional `dedup_count > 1` appends `[xN]`.
pub fn render_alert(alert: &Alert, dedup_count: u32) -> Result<String, RenderError> {
    let body = template_body(alert.kind);
    let mut out = String::with_capacity(body.len());
    let mut chars = body.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '{' => {
                if chars.peek() == Some(&'{') {
                    chars.next();
                    out.push('{');
                    continue;
                }
                let mut key = String::new();
                let mut closed = false;
                for cc in chars.by_ref() {
                    if cc == '}' {
                        closed = true;
                        break;
                    }
                    key.push(cc);
                }
                if !closed || key.is_empty() {
                    return Err(RenderError::UnbalancedBraces(key));
                }
                match alert.fields.get(&key) {
                    Some(v) => out.push_str(v),
                    None => {
                        tracing::warn!(
                            template = ?alert.kind,
                            field = key,
                            "template.missing_field"
                        );
                        out.push_str("<missing>");
                    }
                }
            }
            '}' => {
                if chars.peek() == Some(&'}') {
                    chars.next();
                    out.push('}');
                } else {
                    return Err(RenderError::UnbalancedBraces("stray `}`".into()));
                }
            }
            ch => out.push(ch),
        }
    }
    if dedup_count > 1 {
        out = format!("[x{}] {}", dedup_count, out);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kind::Alert;

    #[test]
    fn every_kind_template_is_well_formed() {
        for kind in AlertKind::all() {
            let body = template_body(*kind);
            template_fields(body).expect("balanced braces");
        }
    }

    #[test]
    fn render_substitutes_known_fields_and_marks_missing() {
        let a = Alert::new(AlertKind::ArchivalFailure, [0u8; 32], 100, 0)
            .with_field("vault_id", "0xAB")
            .with_field("slot", "100")
            .with_field("failure_class", "ArchivalWriteFailed")
            .with_field("variant_tag", "6001")
            .with_field("remediation_id", "rem.archival.failed.abort")
            .with_field("remediation_text", "AbortAndPage");
        let s = render_alert(&a, 1).unwrap();
        assert!(s.contains("ArchivalWriteFailed"));
        assert!(s.contains("0xAB"));
        // last_ok_slot was not provided.
        assert!(s.contains("<missing>"));
        // Single occurrence — no dedup count prefix.
        assert!(!s.starts_with("[x"));
    }

    #[test]
    fn render_dedup_count_prefixes_when_above_one() {
        let a = Alert::new(AlertKind::OracleDeviation, [0u8; 32], 100, 0)
            .with_field("vault_id", "0xAB")
            .with_field("slot", "100")
            .with_field("asset", "USDC")
            .with_field("deviation_bps", "120")
            .with_field("band_bps", "80")
            .with_field("confidence_bps", "5800")
            .with_field("recover_bps", "30");
        let s = render_alert(&a, 5).unwrap();
        assert!(s.starts_with("[x5] "));
    }

    #[test]
    fn defensive_template_renders_directive_example() {
        let a = Alert::new(AlertKind::DefensiveModeEntered, [0u8; 32], 254_819_327, 0)
            .with_field("vault_id", "0x...")
            .with_field("slot", "254819327")
            .with_field("trigger", "volatility_30m_spike")
            .with_field("severity_bps", "8200")
            .with_field("protocol", "Drift")
            .with_field("idle_share_pct", "60")
            .with_field("fallback_protocol", "Kamino")
            .with_field("fallback_share_pct", "40")
            .with_field("public_input_hash", "0x9f...");
        let s = render_alert(&a, 1).unwrap();
        assert!(s.contains("DEFENSIVE MODE"));
        assert!(s.contains("volatility_30m_spike"));
        assert!(s.contains("atlas inspect 0x9f..."));
    }
}

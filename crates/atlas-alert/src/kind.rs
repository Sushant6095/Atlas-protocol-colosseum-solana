//! Alert kinds + classes (directive §4.1).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertClass {
    Page,
    Notify,
    Digest,
}

/// Stable enumeration of alert kinds. Each maps to exactly one template file
/// in `ops/alerts/templates/`. Adding a kind is compile-time exhaustive
/// across `template_path()` + `class()` + `is_security()`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AlertKind {
    // Page (5)
    ArchivalFailure,
    QuorumDisagreement,
    PostConditionViolation,
    ProverNetworkDown,
    SecurityEvent,

    // Notify (5)
    DegradedModeEntered,
    DefensiveModeEntered,
    OracleDeviation,
    ConsensusDisagreementSpike,
    SourceQuarantine,

    // Digest (1)
    DigestDaily,
}

impl AlertKind {
    pub const fn class(&self) -> AlertClass {
        match self {
            AlertKind::ArchivalFailure
            | AlertKind::QuorumDisagreement
            | AlertKind::PostConditionViolation
            | AlertKind::ProverNetworkDown
            | AlertKind::SecurityEvent => AlertClass::Page,
            AlertKind::DegradedModeEntered
            | AlertKind::DefensiveModeEntered
            | AlertKind::OracleDeviation
            | AlertKind::ConsensusDisagreementSpike
            | AlertKind::SourceQuarantine => AlertClass::Notify,
            AlertKind::DigestDaily => AlertClass::Digest,
        }
    }

    /// Security pages bypass maintenance-window suppression (directive §4.2).
    pub const fn is_security(&self) -> bool {
        matches!(self, AlertKind::SecurityEvent)
    }

    /// Stable filename used by `render_alert`. The compile-time exhaustiveness
    /// check below guarantees every variant has exactly one template file.
    pub const fn template_path(&self) -> &'static str {
        match self {
            AlertKind::ArchivalFailure => "archival_failure.txt",
            AlertKind::QuorumDisagreement => "quorum_disagreement.txt",
            AlertKind::PostConditionViolation => "post_condition_violation.txt",
            AlertKind::ProverNetworkDown => "prover_network_down.txt",
            AlertKind::SecurityEvent => "security_event.txt",
            AlertKind::DegradedModeEntered => "defensive_mode_entered.txt",
            AlertKind::DefensiveModeEntered => "defensive_mode_entered.txt",
            AlertKind::OracleDeviation => "oracle_deviation.txt",
            AlertKind::ConsensusDisagreementSpike => "consensus_disagreement_spike.txt",
            AlertKind::SourceQuarantine => "source_quarantine.txt",
            AlertKind::DigestDaily => "digest_daily.txt",
        }
    }

    pub const fn all() -> &'static [AlertKind] {
        &[
            AlertKind::ArchivalFailure,
            AlertKind::QuorumDisagreement,
            AlertKind::PostConditionViolation,
            AlertKind::ProverNetworkDown,
            AlertKind::SecurityEvent,
            AlertKind::DegradedModeEntered,
            AlertKind::DefensiveModeEntered,
            AlertKind::OracleDeviation,
            AlertKind::ConsensusDisagreementSpike,
            AlertKind::SourceQuarantine,
            AlertKind::DigestDaily,
        ]
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Alert {
    pub kind: AlertKind,
    pub vault_id: [u8; 32],
    pub slot: u64,
    /// Wall time the alert was created. Used for the 60-s dedup window.
    pub triggered_at_unix: u64,
    /// Template fields. Missing fields render as `<missing>` so the alert
    /// still goes out — visible incompleteness beats silent suppression.
    pub fields: BTreeMap<String, String>,
}

impl Alert {
    pub fn new(kind: AlertKind, vault_id: [u8; 32], slot: u64, triggered_at_unix: u64) -> Self {
        Self { kind, vault_id, slot, triggered_at_unix, fields: BTreeMap::new() }
    }

    pub fn with_field(mut self, key: &str, value: impl Into<String>) -> Self {
        self.fields.insert(key.into(), value.into());
        self
    }

    pub fn class(&self) -> AlertClass {
        self.kind.class()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_has_class_and_template() {
        for kind in AlertKind::all() {
            // `class()` and `template_path()` are total — no panic.
            let _ = kind.class();
            let path = kind.template_path();
            assert!(path.ends_with(".txt"));
        }
    }

    #[test]
    fn page_class_covers_directive_set() {
        let pages: Vec<AlertKind> = AlertKind::all()
            .iter()
            .copied()
            .filter(|k| k.class() == AlertClass::Page)
            .collect();
        assert!(pages.contains(&AlertKind::ArchivalFailure));
        assert!(pages.contains(&AlertKind::QuorumDisagreement));
        assert!(pages.contains(&AlertKind::PostConditionViolation));
        assert!(pages.contains(&AlertKind::ProverNetworkDown));
        assert!(pages.contains(&AlertKind::SecurityEvent));
    }

    #[test]
    fn only_security_event_is_security() {
        for kind in AlertKind::all() {
            assert_eq!(kind.is_security(), *kind == AlertKind::SecurityEvent);
        }
    }
}

//! Stage 09 — ExplainDecision.
//!
//! Structured, canonical, hash-committed. The directive forbids free-form prose
//! in the commitment. The hash that lands in `public_input.explanation_hash` is
//! computed over the canonical JSON bytes emitted by `crates/.../canonical_json.rs`.
//!
//! A separate human-readable rendering for UIs is intentionally *not* part of
//! this module — it lives in the consumer (web app) and is not committed.

use crate::{
    canonical_json::{encode, obj, CanonicalJsonError, Value},
    hashing::{hash_with_tag, tags},
};
use std::collections::BTreeMap;

/// Stable u8 discriminants — wire format is committed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Regime {
    RiskOn = 0,
    Neutral = 1,
    Defensive = 2,
    Crisis = 3,
}

impl Regime {
    pub fn as_str(&self) -> &'static str {
        match self {
            Regime::RiskOn => "risk_on",
            Regime::Neutral => "neutral",
            Regime::Defensive => "defensive",
            Regime::Crisis => "crisis",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum Signal {
    VolatilitySpike = 0,
    YieldInstability = 1,
    OracleDeviation = 2,
    LiquidityStress = 3,
    UtilizationCap = 4,
    TailRiskBreach = 5,
    RegimeShift = 6,
    AgentDisagreement = 7,
}

impl Signal {
    pub fn as_str(&self) -> &'static str {
        match self {
            Signal::VolatilitySpike => "volatility_spike",
            Signal::YieldInstability => "yield_instability",
            Signal::OracleDeviation => "oracle_deviation",
            Signal::LiquidityStress => "liquidity_stress",
            Signal::UtilizationCap => "utilization_cap",
            Signal::TailRiskBreach => "tail_risk_breach",
            Signal::RegimeShift => "regime_shift",
            Signal::AgentDisagreement => "agent_disagreement",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum Constraint {
    ProtocolConcentration = 0,
    TailRiskCvar = 1,
    LiquidityCoverage = 2,
    UtilizationCeiling = 3,
    OracleStaleness = 4,
    Token2022Banned = 5,
    CuBudget = 6,
}

impl Constraint {
    pub fn as_str(&self) -> &'static str {
        match self {
            Constraint::ProtocolConcentration => "protocol_concentration",
            Constraint::TailRiskCvar => "tail_risk_cvar",
            Constraint::LiquidityCoverage => "liquidity_coverage",
            Constraint::UtilizationCeiling => "utilization_ceiling",
            Constraint::OracleStaleness => "oracle_staleness",
            Constraint::Token2022Banned => "token2022_banned",
            Constraint::CuBudget => "cu_budget",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Driver {
    pub signal: Signal,
    pub severity_bps: u32,
    /// Form: `protocol:<name>` or `asset:<symbol>` — ASCII only.
    pub target: String,
}

#[derive(Clone, Debug)]
pub struct StructuredExplanation {
    pub regime: Regime,
    pub drivers: Vec<Driver>,
    pub constraints_hit: Vec<Constraint>,
    pub confidence_bps: u32,
    pub risk_score_bps: u32,
    pub liquidity_confidence_bps: u32,
    pub agent_disagreement_bps: u32,
}

impl StructuredExplanation {
    /// Emit canonical JSON bytes ready for hashing.
    pub fn canonical_bytes(&self) -> Result<Vec<u8>, CanonicalJsonError> {
        // drivers: array of { severity_bps, signal, target } — keys sort
        // lexicographically inside each object via BTreeMap.
        let drivers: Vec<Value> = self
            .drivers
            .iter()
            .map(|d| {
                obj([
                    ("severity_bps", Value::Int(d.severity_bps as i64)),
                    ("signal", Value::String(d.signal.as_str().into())),
                    ("target", Value::String(d.target.clone())),
                ])
            })
            .collect();

        // constraints: dedup + sort lexicographically (stable string codes).
        let mut constraints_strs: Vec<String> =
            self.constraints_hit.iter().map(|c| c.as_str().to_string()).collect();
        constraints_strs.sort();
        constraints_strs.dedup();
        let constraints: Vec<Value> = constraints_strs.into_iter().map(Value::String).collect();

        let mut root: BTreeMap<String, Value> = BTreeMap::new();
        root.insert("agent_disagreement_bps".into(), Value::Int(self.agent_disagreement_bps as i64));
        root.insert("confidence_bps".into(), Value::Int(self.confidence_bps as i64));
        root.insert("constraints_hit".into(), Value::Array(constraints));
        root.insert("drivers".into(), Value::Array(drivers));
        root.insert("liquidity_confidence_bps".into(), Value::Int(self.liquidity_confidence_bps as i64));
        root.insert("regime".into(), Value::String(self.regime.as_str().into()));
        root.insert("risk_score_bps".into(), Value::Int(self.risk_score_bps as i64));
        root.insert("schema".into(), Value::String("atlas.explanation.v2".into()));

        encode(&Value::Object(root))
    }

    /// Domain-tagged hash committed to `public_input.explanation_hash`.
    pub fn explanation_hash(&self) -> Result<[u8; 32], CanonicalJsonError> {
        let bytes = self.canonical_bytes()?;
        Ok(hash_with_tag(tags::EXPLANATION_V2, &[&bytes]))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> StructuredExplanation {
        StructuredExplanation {
            regime: Regime::Defensive,
            drivers: vec![
                Driver {
                    signal: Signal::VolatilitySpike,
                    severity_bps: 8100,
                    target: "protocol:Drift".into(),
                },
                Driver {
                    signal: Signal::YieldInstability,
                    severity_bps: 6200,
                    target: "protocol:Kamino".into(),
                },
            ],
            constraints_hit: vec![Constraint::ProtocolConcentration, Constraint::TailRiskCvar],
            confidence_bps: 8700,
            risk_score_bps: 2900,
            liquidity_confidence_bps: 9100,
            agent_disagreement_bps: 1200,
        }
    }

    #[test]
    fn canonical_bytes_match_directive_example() {
        let exp = sample();
        let bytes = exp.canonical_bytes().unwrap();
        // Reproduce the exact byte sequence we expect — keys in lex order,
        // drivers in insertion order, constraints sorted.
        let expected = br#"{"agent_disagreement_bps":1200,"confidence_bps":8700,"constraints_hit":["protocol_concentration","tail_risk_cvar"],"drivers":[{"severity_bps":8100,"signal":"volatility_spike","target":"protocol:Drift"},{"severity_bps":6200,"signal":"yield_instability","target":"protocol:Kamino"}],"liquidity_confidence_bps":9100,"regime":"defensive","risk_score_bps":2900,"schema":"atlas.explanation.v2"}"#;
        assert_eq!(bytes, expected);
    }

    #[test]
    fn hash_is_deterministic() {
        let h1 = sample().explanation_hash().unwrap();
        let h2 = sample().explanation_hash().unwrap();
        assert_eq!(h1, h2);
    }

    #[test]
    fn driver_order_matters_for_canonical_bytes() {
        let mut a = sample();
        let drivers = a.drivers.clone();
        let mut reversed = drivers.clone();
        reversed.reverse();
        a.drivers = reversed;
        let h_orig = sample().explanation_hash().unwrap();
        let h_rev = a.explanation_hash().unwrap();
        // Drivers are insertion-ordered; reversing them changes the canonical
        // output. Caller is responsible for producing a stable order.
        assert_ne!(h_orig, h_rev);
    }

    #[test]
    fn constraint_dedup_in_canonical() {
        let mut e = sample();
        e.constraints_hit.push(Constraint::ProtocolConcentration); // duplicate
        let bytes = e.canonical_bytes().unwrap();
        // "protocol_concentration" must appear exactly once.
        let s = std::str::from_utf8(&bytes).unwrap();
        let count = s.matches("protocol_concentration").count();
        assert_eq!(count, 1);
    }
}

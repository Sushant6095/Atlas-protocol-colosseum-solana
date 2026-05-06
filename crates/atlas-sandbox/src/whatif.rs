//! What-if engine (directive §1.4).
//!
//! Counterfactual perturbations layered on top of a recorded slot range.
//! The plan parser accepts the directive's CLI shapes:
//!
//! ```text
//!   --override agent.YieldMax.weight=0
//!   --override threshold.tau_disagree=0.10
//!   --inject scenario:oracle_drift,asset:SOL,bps:50,duration_slots:1000
//!   --allocation-floor protocol:Drift,bps:0
//! ```
//!
//! Plans are deterministic: the parsed plan + recorded slot range produce
//! the same delta report on every run.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum Override {
    AgentWeight { agent: String, weight_bps: u32 },
    Threshold { name: String, value_bps: u32 },
    AllocationFloor { protocol: String, floor_bps: u32 },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ScenarioInjection {
    pub scenario: String,
    pub asset: Option<String>,
    pub bps: Option<u32>,
    pub duration_slots: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Default)]
pub struct WhatIfPlan {
    pub overrides: Vec<Override>,
    pub injections: Vec<ScenarioInjection>,
}

impl WhatIfPlan {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn parse_override(s: &str) -> Result<Override, ParseError> {
        // Accept dotted-form: `agent.YieldMax.weight=0`, `threshold.tau_disagree=0.10`.
        let (lhs, rhs) = s.split_once('=').ok_or(ParseError::MissingEquals)?;
        let value_bps = parse_value_bps(rhs)?;
        let parts: Vec<&str> = lhs.split('.').collect();
        match parts.as_slice() {
            ["agent", agent, "weight"] => Ok(Override::AgentWeight {
                agent: (*agent).to_string(),
                weight_bps: value_bps,
            }),
            ["threshold", name] => Ok(Override::Threshold {
                name: (*name).to_string(),
                value_bps,
            }),
            _ => Err(ParseError::UnknownKey(lhs.to_string())),
        }
    }

    pub fn parse_inject(s: &str) -> Result<ScenarioInjection, ParseError> {
        // `scenario:oracle_drift,asset:SOL,bps:50,duration_slots:1000`
        let mut scenario: Option<String> = None;
        let mut asset: Option<String> = None;
        let mut bps: Option<u32> = None;
        let mut duration_slots: Option<u64> = None;
        for part in s.split(',') {
            let (k, v) = part.split_once(':').ok_or(ParseError::MissingColon)?;
            match k.trim() {
                "scenario" => scenario = Some(v.trim().to_string()),
                "asset" => asset = Some(v.trim().to_string()),
                "bps" => bps = Some(v.trim().parse().map_err(|_| ParseError::BadNumber)?),
                "duration_slots" => {
                    duration_slots = Some(v.trim().parse().map_err(|_| ParseError::BadNumber)?)
                }
                other => return Err(ParseError::UnknownKey(other.to_string())),
            }
        }
        Ok(ScenarioInjection {
            scenario: scenario.ok_or(ParseError::MissingField("scenario"))?,
            asset,
            bps,
            duration_slots,
        })
    }

    pub fn parse_allocation_floor(s: &str) -> Result<Override, ParseError> {
        // `protocol:Drift,bps:0`
        let mut protocol: Option<String> = None;
        let mut floor_bps: Option<u32> = None;
        for part in s.split(',') {
            let (k, v) = part.split_once(':').ok_or(ParseError::MissingColon)?;
            match k.trim() {
                "protocol" => protocol = Some(v.trim().to_string()),
                "bps" => floor_bps = Some(v.trim().parse().map_err(|_| ParseError::BadNumber)?),
                other => return Err(ParseError::UnknownKey(other.to_string())),
            }
        }
        Ok(Override::AllocationFloor {
            protocol: protocol.ok_or(ParseError::MissingField("protocol"))?,
            floor_bps: floor_bps.ok_or(ParseError::MissingField("bps"))?,
        })
    }
}

fn parse_value_bps(s: &str) -> Result<u32, ParseError> {
    // Accept either bps integer ("50") or fractional ("0.10" → 1_000 bps).
    let trimmed = s.trim();
    if let Some(dot_idx) = trimmed.find('.') {
        let whole: u32 = trimmed[..dot_idx].parse().map_err(|_| ParseError::BadNumber)?;
        let frac_str = &trimmed[dot_idx + 1..];
        if frac_str.len() > 4 {
            return Err(ParseError::BadNumber);
        }
        let pad: String = frac_str.chars().chain("0000".chars()).take(4).collect();
        let frac: u32 = pad.parse().map_err(|_| ParseError::BadNumber)?;
        Ok(whole.saturating_mul(10_000).saturating_add(frac))
    } else {
        trimmed.parse().map_err(|_| ParseError::BadNumber)
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ParseError {
    #[error("missing `=`")]
    MissingEquals,
    #[error("missing `:`")]
    MissingColon,
    #[error("unknown key: {0}")]
    UnknownKey(String),
    #[error("bad number")]
    BadNumber,
    #[error("missing field: {0}")]
    MissingField(&'static str),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_agent_weight_override() {
        let o = WhatIfPlan::parse_override("agent.YieldMax.weight=0").unwrap();
        assert_eq!(
            o,
            Override::AgentWeight { agent: "YieldMax".into(), weight_bps: 0 }
        );
    }

    #[test]
    fn parses_threshold_override_fractional() {
        let o = WhatIfPlan::parse_override("threshold.tau_disagree=0.10").unwrap();
        assert_eq!(
            o,
            Override::Threshold { name: "tau_disagree".into(), value_bps: 1_000 }
        );
    }

    #[test]
    fn parses_scenario_injection() {
        let s = WhatIfPlan::parse_inject(
            "scenario:oracle_drift,asset:SOL,bps:50,duration_slots:1000",
        )
        .unwrap();
        assert_eq!(s.scenario, "oracle_drift");
        assert_eq!(s.asset.as_deref(), Some("SOL"));
        assert_eq!(s.bps, Some(50));
        assert_eq!(s.duration_slots, Some(1_000));
    }

    #[test]
    fn parses_allocation_floor() {
        let o = WhatIfPlan::parse_allocation_floor("protocol:Drift,bps:0").unwrap();
        assert_eq!(
            o,
            Override::AllocationFloor { protocol: "Drift".into(), floor_bps: 0 }
        );
    }

    #[test]
    fn rejects_unknown_override() {
        assert!(matches!(
            WhatIfPlan::parse_override("bogus.thing=5"),
            Err(ParseError::UnknownKey(_))
        ));
    }
}

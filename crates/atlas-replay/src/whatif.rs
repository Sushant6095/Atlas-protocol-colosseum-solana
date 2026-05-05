//! `atlas-replay what-if` — counterfactual replay.
//!
//! Format of `--override` arguments: `agent.<AgentName>.weight=<bps>`.
//! Anything else is rejected — directive §11 demands typed errors.

use anyhow::{anyhow, Result};
use atlas_pipeline::stages::agents::AgentId;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Override {
    AgentWeight { agent: AgentId, weight_bps: u32 },
}

pub fn parse_override(s: &str) -> Result<Override> {
    let mut parts = s.splitn(2, '=');
    let lhs = parts.next().ok_or_else(|| anyhow!("missing key"))?;
    let rhs = parts.next().ok_or_else(|| anyhow!("missing value"))?;
    let segments: Vec<&str> = lhs.split('.').collect();
    if segments.len() != 3 || segments[0] != "agent" {
        return Err(anyhow!(
            "unsupported override key `{lhs}` — only `agent.<AgentName>.weight=<bps>` is recognized"
        ));
    }
    let agent = match segments[1] {
        "YieldMax" => AgentId::YieldMax,
        "VolSuppress" => AgentId::VolSuppress,
        "LiquidityStability" => AgentId::LiquidityStability,
        "TailRisk" => AgentId::TailRisk,
        "ExecEfficiency" => AgentId::ExecEfficiency,
        "ProtocolExposure" => AgentId::ProtocolExposure,
        "EmergencySentinel" => AgentId::EmergencySentinel,
        other => return Err(anyhow!("unknown agent `{other}`")),
    };
    if segments[2] != "weight" {
        return Err(anyhow!(
            "unsupported override field `{}` — only `weight` is recognized",
            segments[2]
        ));
    }
    let weight_bps: u32 = rhs.parse().map_err(|_| anyhow!("invalid weight: `{rhs}`"))?;
    if weight_bps > 10_000 {
        return Err(anyhow!("weight {weight_bps} > 10_000 bps"));
    }
    Ok(Override::AgentWeight { agent, weight_bps })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_yieldmax_zero() {
        let o = parse_override("agent.YieldMax.weight=0").unwrap();
        assert_eq!(o, Override::AgentWeight { agent: AgentId::YieldMax, weight_bps: 0 });
    }

    #[test]
    fn parses_tailrisk_full() {
        let o = parse_override("agent.TailRisk.weight=10000").unwrap();
        assert_eq!(o, Override::AgentWeight { agent: AgentId::TailRisk, weight_bps: 10_000 });
    }

    #[test]
    fn rejects_unknown_agent() {
        assert!(parse_override("agent.NoSuchAgent.weight=5000").is_err());
    }

    #[test]
    fn rejects_unknown_field() {
        assert!(parse_override("agent.YieldMax.confidence=5000").is_err());
    }

    #[test]
    fn rejects_out_of_range() {
        assert!(parse_override("agent.YieldMax.weight=99999").is_err());
    }

    #[test]
    fn rejects_unsupported_namespace() {
        assert!(parse_override("vault.foo.bar=1").is_err());
    }
}

//! atlas-vault-templates — Kamino-targeted vault templates (directive 09 §6).
//!
//! Three templates ship at launch:
//!
//! * `kamino-stable-balanced`  — Kamino main + idle + small Drift,
//!   conservative drift band.
//! * `kamino-yield-aggressive` — Kamino + Marginfi + Drift, larger
//!   drift band, higher rebalance frequency.
//! * `kamino-vol-suppress`     — Kamino weighted high, defensive
//!   vector heavy on idle.
//!
//! Each template exposes 3 risk bands (`Conservative`, `Balanced`,
//! `Aggressive`). The chosen band is part of the strategy commitment;
//! once a vault is created the band cannot drift.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use atlas_failure::class::{AgentId, ProtocolId};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskBand {
    Conservative,
    Balanced,
    Aggressive,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TemplateId {
    KaminoStableBalanced,
    KaminoYieldAggressive,
    KaminoVolSuppress,
    /// PUSD-native conservative template (directive 10 §2):
    /// Kamino main + Marginfi + idle, Drift forbidden.
    PusdSafeYield,
    /// PUSD-native default template:
    /// Kamino + Marginfi + Drift (small) + idle.
    PusdYieldBalanced,
    /// PUSD-native treasury default:
    /// idle-heavy, Kamino conservative, large defensive vector.
    PusdTreasuryDefense,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentWeight {
    pub agent: AgentId,
    pub weight_bps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TemplateAllocation {
    pub protocol: ProtocolId,
    pub bps: u32,
    pub label: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultTemplate {
    pub id: TemplateId,
    pub band: RiskBand,
    pub allocations: Vec<TemplateAllocation>,
    pub agent_weights: Vec<AgentWeight>,
    pub drift_band_bps: u32,
    pub rebalance_frequency_slots: u64,
    /// Required: every template ships with a backtest report URI.
    pub backtest_report_uri: String,
    /// `commitment_hash = blake3("atlas.template.v1" || canonical_bytes)`.
    pub commitment_hash: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TemplateError {
    #[error("allocation bps must sum to 10_000 (got {0})")]
    AllocationNotUnit(u32),
    #[error("agent weights must sum to 10_000 (got {0})")]
    AgentWeightsNotUnit(u32),
    #[error("backtest_report_uri is required for any approved template")]
    MissingBacktestReport,
    #[error("commitment hash mismatch: claimed={claimed:?}, computed={computed:?}")]
    CommitmentHashMismatch { claimed: [u8; 32], computed: [u8; 32] },
}

impl VaultTemplate {
    pub fn validate(&self) -> Result<(), TemplateError> {
        let alloc_sum: u32 = self.allocations.iter().map(|a| a.bps).sum();
        if alloc_sum != 10_000 {
            return Err(TemplateError::AllocationNotUnit(alloc_sum));
        }
        let agent_sum: u32 = self.agent_weights.iter().map(|a| a.weight_bps).sum();
        if agent_sum != 10_000 {
            return Err(TemplateError::AgentWeightsNotUnit(agent_sum));
        }
        if self.backtest_report_uri.is_empty() {
            return Err(TemplateError::MissingBacktestReport);
        }
        let computed = self.compute_commitment_hash();
        if computed != self.commitment_hash {
            return Err(TemplateError::CommitmentHashMismatch {
                claimed: self.commitment_hash,
                computed,
            });
        }
        Ok(())
    }

    pub fn compute_commitment_hash(&self) -> [u8; 32] {
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.template.v1");
        h.update(format!("{:?}", self.id).as_bytes());
        h.update(format!("{:?}", self.band).as_bytes());
        for a in &self.allocations {
            h.update(&a.protocol.0.to_le_bytes());
            h.update(&a.bps.to_le_bytes());
            h.update(a.label.as_bytes());
        }
        for w in &self.agent_weights {
            h.update(&[w.agent as u8]);
            h.update(&w.weight_bps.to_le_bytes());
        }
        h.update(&self.drift_band_bps.to_le_bytes());
        h.update(&self.rebalance_frequency_slots.to_le_bytes());
        h.update(self.backtest_report_uri.as_bytes());
        *h.finalize().as_bytes()
    }
}

/// Build the canonical template for a given `(id, band)`. The
/// implementation here pins the directive's allocations + frequencies;
/// the commitment_hash is recomputed so the result always validates.
pub fn build(id: TemplateId, band: RiskBand) -> VaultTemplate {
    let (allocations, agent_weights, frequency_slots) = match (id, band) {
        (TemplateId::KaminoStableBalanced, RiskBand::Conservative) => (
            vec![
                alloc(ProtocolId(1), 7_500, "kamino-main"),
                alloc(ProtocolId(2), 1_500, "drift-perp"),
                alloc(ProtocolId(0), 1_000, "idle"),
            ],
            balanced_agent_weights(),
            54_000, // ≈ 6h
        ),
        (TemplateId::KaminoStableBalanced, RiskBand::Balanced) => (
            vec![
                alloc(ProtocolId(1), 6_000, "kamino-main"),
                alloc(ProtocolId(2), 3_000, "drift-perp"),
                alloc(ProtocolId(0), 1_000, "idle"),
            ],
            balanced_agent_weights(),
            36_000, // ≈ 4h
        ),
        (TemplateId::KaminoStableBalanced, RiskBand::Aggressive) => (
            vec![
                alloc(ProtocolId(1), 5_000, "kamino-main"),
                alloc(ProtocolId(2), 4_500, "drift-perp"),
                alloc(ProtocolId(0), 500, "idle"),
            ],
            aggressive_agent_weights(),
            18_000, // ≈ 2h
        ),
        (TemplateId::KaminoYieldAggressive, RiskBand::Conservative) => (
            vec![
                alloc(ProtocolId(1), 4_000, "kamino-main"),
                alloc(ProtocolId(3), 3_000, "marginfi"),
                alloc(ProtocolId(2), 2_000, "drift-perp"),
                alloc(ProtocolId(0), 1_000, "idle"),
            ],
            balanced_agent_weights(),
            36_000,
        ),
        (TemplateId::KaminoYieldAggressive, RiskBand::Balanced) => (
            vec![
                alloc(ProtocolId(1), 3_500, "kamino-main"),
                alloc(ProtocolId(3), 3_000, "marginfi"),
                alloc(ProtocolId(2), 3_000, "drift-perp"),
                alloc(ProtocolId(0), 500, "idle"),
            ],
            aggressive_agent_weights(),
            18_000,
        ),
        (TemplateId::KaminoYieldAggressive, RiskBand::Aggressive) => (
            vec![
                alloc(ProtocolId(1), 3_000, "kamino-main"),
                alloc(ProtocolId(3), 3_500, "marginfi"),
                alloc(ProtocolId(2), 3_500, "drift-perp"),
                alloc(ProtocolId(0), 0, "idle"),
            ],
            aggressive_agent_weights(),
            9_000, // ≈ 1h
        ),
        (TemplateId::KaminoVolSuppress, _band) => (
            vec![
                alloc(ProtocolId(1), 5_000, "kamino-main"),
                alloc(ProtocolId(0), 4_500, "idle"),
                alloc(ProtocolId(2), 500, "drift-perp"),
            ],
            vol_suppress_agent_weights(),
            72_000, // ≈ 8h
        ),
        // ── PUSD-native templates (directive 10 §2) ─────────────────
        // pusd-safe-yield: Kamino + Marginfi + idle, Drift forbidden.
        (TemplateId::PusdSafeYield, RiskBand::Conservative) => (
            vec![
                alloc(ProtocolId(1), 6_000, "kamino-main"),
                alloc(ProtocolId(3), 2_500, "marginfi"),
                alloc(ProtocolId(0), 1_500, "idle"),
            ],
            balanced_agent_weights(),
            54_000,
        ),
        (TemplateId::PusdSafeYield, RiskBand::Balanced) => (
            vec![
                alloc(ProtocolId(1), 5_500, "kamino-main"),
                alloc(ProtocolId(3), 3_500, "marginfi"),
                alloc(ProtocolId(0), 1_000, "idle"),
            ],
            balanced_agent_weights(),
            36_000,
        ),
        (TemplateId::PusdSafeYield, RiskBand::Aggressive) => (
            vec![
                alloc(ProtocolId(1), 5_000, "kamino-main"),
                alloc(ProtocolId(3), 4_000, "marginfi"),
                alloc(ProtocolId(0), 1_000, "idle"),
            ],
            aggressive_agent_weights(),
            18_000,
        ),
        // pusd-yield-balanced: Kamino + Marginfi + Drift (small) + idle.
        (TemplateId::PusdYieldBalanced, RiskBand::Conservative) => (
            vec![
                alloc(ProtocolId(1), 4_500, "kamino-main"),
                alloc(ProtocolId(3), 3_000, "marginfi"),
                alloc(ProtocolId(2), 1_000, "drift-perp"),
                alloc(ProtocolId(0), 1_500, "idle"),
            ],
            balanced_agent_weights(),
            36_000,
        ),
        (TemplateId::PusdYieldBalanced, RiskBand::Balanced) => (
            vec![
                alloc(ProtocolId(1), 4_000, "kamino-main"),
                alloc(ProtocolId(3), 3_000, "marginfi"),
                alloc(ProtocolId(2), 2_000, "drift-perp"),
                alloc(ProtocolId(0), 1_000, "idle"),
            ],
            balanced_agent_weights(),
            18_000,
        ),
        (TemplateId::PusdYieldBalanced, RiskBand::Aggressive) => (
            vec![
                alloc(ProtocolId(1), 3_500, "kamino-main"),
                alloc(ProtocolId(3), 3_000, "marginfi"),
                alloc(ProtocolId(2), 3_000, "drift-perp"),
                alloc(ProtocolId(0), 500, "idle"),
            ],
            aggressive_agent_weights(),
            9_000,
        ),
        // pusd-treasury-defense: idle-heavy, Kamino conservative.
        (TemplateId::PusdTreasuryDefense, _band) => (
            vec![
                alloc(ProtocolId(0), 6_000, "idle"),
                alloc(ProtocolId(1), 3_500, "kamino-main"),
                alloc(ProtocolId(3), 500, "marginfi"),
            ],
            vol_suppress_agent_weights(),
            72_000,
        ),
    };
    let drift_band_bps = match band {
        RiskBand::Conservative => 200,
        RiskBand::Balanced => 500,
        RiskBand::Aggressive => 1_000,
    };
    let mut t = VaultTemplate {
        id,
        band,
        allocations,
        agent_weights,
        drift_band_bps,
        rebalance_frequency_slots: frequency_slots,
        backtest_report_uri: format!("sandbox://atlas/reports/{:?}-{:?}.json", id, band),
        commitment_hash: [0u8; 32],
    };
    t.commitment_hash = t.compute_commitment_hash();
    t
}

fn alloc(p: ProtocolId, bps: u32, label: &str) -> TemplateAllocation {
    TemplateAllocation { protocol: p, bps, label: label.into() }
}

fn balanced_agent_weights() -> Vec<AgentWeight> {
    vec![
        AgentWeight { agent: AgentId::YieldMax, weight_bps: 2_500 },
        AgentWeight { agent: AgentId::VolSuppress, weight_bps: 1_500 },
        AgentWeight { agent: AgentId::LiquidityStability, weight_bps: 1_500 },
        AgentWeight { agent: AgentId::TailRisk, weight_bps: 1_500 },
        AgentWeight { agent: AgentId::ExecEfficiency, weight_bps: 1_000 },
        AgentWeight { agent: AgentId::ProtocolExposure, weight_bps: 1_000 },
        AgentWeight { agent: AgentId::EmergencySentinel, weight_bps: 1_000 },
    ]
}

fn aggressive_agent_weights() -> Vec<AgentWeight> {
    vec![
        AgentWeight { agent: AgentId::YieldMax, weight_bps: 4_000 },
        AgentWeight { agent: AgentId::VolSuppress, weight_bps: 1_000 },
        AgentWeight { agent: AgentId::LiquidityStability, weight_bps: 1_500 },
        AgentWeight { agent: AgentId::TailRisk, weight_bps: 1_000 },
        AgentWeight { agent: AgentId::ExecEfficiency, weight_bps: 1_000 },
        AgentWeight { agent: AgentId::ProtocolExposure, weight_bps: 1_000 },
        AgentWeight { agent: AgentId::EmergencySentinel, weight_bps: 500 },
    ]
}

fn vol_suppress_agent_weights() -> Vec<AgentWeight> {
    vec![
        AgentWeight { agent: AgentId::YieldMax, weight_bps: 1_000 },
        AgentWeight { agent: AgentId::VolSuppress, weight_bps: 3_500 },
        AgentWeight { agent: AgentId::LiquidityStability, weight_bps: 1_500 },
        AgentWeight { agent: AgentId::TailRisk, weight_bps: 1_500 },
        AgentWeight { agent: AgentId::ExecEfficiency, weight_bps: 500 },
        AgentWeight { agent: AgentId::ProtocolExposure, weight_bps: 500 },
        AgentWeight { agent: AgentId::EmergencySentinel, weight_bps: 1_500 },
    ]
}

pub const ALL_TEMPLATES: &[TemplateId] = &[
    TemplateId::KaminoStableBalanced,
    TemplateId::KaminoYieldAggressive,
    TemplateId::KaminoVolSuppress,
    TemplateId::PusdSafeYield,
    TemplateId::PusdYieldBalanced,
    TemplateId::PusdTreasuryDefense,
];

/// Subset of templates that are PUSD-native (directive 10 §2).
pub const PUSD_TEMPLATES: &[TemplateId] = &[
    TemplateId::PusdSafeYield,
    TemplateId::PusdYieldBalanced,
    TemplateId::PusdTreasuryDefense,
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_template_band_combination_validates() {
        for id in ALL_TEMPLATES {
            for band in [RiskBand::Conservative, RiskBand::Balanced, RiskBand::Aggressive] {
                let t = build(*id, band);
                t.validate().expect("template must validate");
            }
        }
    }

    #[test]
    fn pusd_safe_yield_excludes_drift() {
        for band in [RiskBand::Conservative, RiskBand::Balanced, RiskBand::Aggressive] {
            let t = build(TemplateId::PusdSafeYield, band);
            // Drift is ProtocolId(2) — directive forbids it from
            // pusd-safe-yield.
            assert!(!t.allocations.iter().any(|a| a.protocol == ProtocolId(2)));
        }
    }

    #[test]
    fn pusd_treasury_defense_is_idle_heavy() {
        let t = build(TemplateId::PusdTreasuryDefense, RiskBand::Balanced);
        let idle = t.allocations.iter().find(|a| a.protocol == ProtocolId(0)).unwrap();
        assert!(idle.bps >= 5_000, "idle allocation must dominate, got {}", idle.bps);
    }

    #[test]
    fn pusd_template_count_is_three() {
        assert_eq!(PUSD_TEMPLATES.len(), 3);
    }

    #[test]
    fn drift_band_widens_with_band() {
        let c = build(TemplateId::KaminoStableBalanced, RiskBand::Conservative);
        let b = build(TemplateId::KaminoStableBalanced, RiskBand::Balanced);
        let a = build(TemplateId::KaminoStableBalanced, RiskBand::Aggressive);
        assert!(c.drift_band_bps < b.drift_band_bps);
        assert!(b.drift_band_bps < a.drift_band_bps);
    }

    #[test]
    fn commitment_hash_changes_when_template_changes() {
        let a = build(TemplateId::KaminoStableBalanced, RiskBand::Balanced);
        let b = build(TemplateId::KaminoYieldAggressive, RiskBand::Balanced);
        assert_ne!(a.commitment_hash, b.commitment_hash);
    }

    #[test]
    fn commitment_hash_changes_when_band_changes() {
        let a = build(TemplateId::KaminoVolSuppress, RiskBand::Conservative);
        let b = build(TemplateId::KaminoVolSuppress, RiskBand::Aggressive);
        // Vol-suppress allocation is band-independent, but agent weights /
        // drift band still differ → commitment changes.
        assert_ne!(a.commitment_hash, b.commitment_hash);
    }

    #[test]
    fn empty_backtest_report_rejects() {
        let mut t = build(TemplateId::KaminoStableBalanced, RiskBand::Balanced);
        t.backtest_report_uri.clear();
        t.commitment_hash = t.compute_commitment_hash();
        assert!(matches!(t.validate(), Err(TemplateError::MissingBacktestReport)));
    }
}

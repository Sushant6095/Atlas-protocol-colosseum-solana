//! `WalletIntelligenceReport` schema + recommendation scorer
//! (directive §2).

use atlas_runtime::Pubkey;
use atlas_vault_templates::TemplateId;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const REPORT_SCHEMA_V1: &str = "atlas.wallet_intel.v1";
pub const MAX_RECOMMENDATIONS: usize = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetBucket {
    Stablecoins,
    Volatile,
    LpPositions,
    Lending,
    Perps,
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ExposureSummary {
    pub by_protocol_bps: BTreeMap<String, u32>,
    pub by_asset_bps: BTreeMap<String, u32>,
    pub concentration_index_bps: u32,
    pub leverage_ratio_bps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct BehaviorMetrics {
    pub tx_count_30d: u32,
    pub avg_hold_duration_days: u32,
    pub rotation_frequency_per_30d: u32,
    pub withdrawal_burst_events_30d: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecommendationKind {
    /// Idle stablecoin share is large enough to deploy.
    IdleCapital,
    /// Concentration in one protocol exceeds healthy band.
    ReduceConcentration,
    /// Leverage ratio above policy guard.
    DeleverageHint,
    /// Behavior pattern (rotation frequency / withdrawal bursts)
    /// suggests a defensive template.
    DefensiveTemplate,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AtlasAction {
    pub vault_template: TemplateId,
    pub amount_q64: u128,
    pub projected_apy_bps: i32,
    pub projected_risk_delta_bps: i32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WalletRecommendation {
    pub kind: RecommendationKind,
    pub severity: String,
    pub detail: String,
    pub atlas_action: AtlasAction,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct WalletIntelligenceReport {
    pub schema: String,
    pub wallet: Pubkey,
    pub as_of_slot: u64,
    pub balances_by_bucket_q64: BTreeMap<String, u128>,
    pub stablecoin_share_bps: u32,
    pub exposure: ExposureSummary,
    pub behavior: BehaviorMetrics,
    pub risk_score_bps: u32,
    pub recommendations: Vec<WalletRecommendation>,
    pub generated_by: String,
    pub intelligence_sources: Vec<String>,
    pub verifiable_via: String,
}

/// Inputs to the deterministic recommendation scorer (§2.3). The
/// scorer is intentionally a small, auditable function — NOT the
/// Phase 01 allocation pipeline. It outputs at most three
/// recommendations.
#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct ScoreInputs {
    pub stablecoin_share_bps: u32,
    pub max_protocol_exposure_bps: u32,
    pub leverage_ratio_bps: u32,
    pub rotation_frequency_per_30d: u32,
    pub withdrawal_burst_events_30d: u32,
    pub idle_stablecoin_balance_q64: u128,
}

/// Deterministic scorer. Same inputs → same output, byte-identical.
pub fn score_wallet(inputs: &ScoreInputs) -> Vec<WalletRecommendation> {
    let mut out = Vec::new();

    // 1. Idle capital deployment (highest leverage, score first).
    if inputs.stablecoin_share_bps >= 6_000 && inputs.idle_stablecoin_balance_q64 > 0 {
        out.push(WalletRecommendation {
            kind: RecommendationKind::IdleCapital,
            severity: "info".into(),
            detail: format!(
                "{}% of holdings are idle stablecoins",
                inputs.stablecoin_share_bps / 100
            ),
            atlas_action: AtlasAction {
                vault_template: TemplateId::PusdSafeYield,
                amount_q64: inputs.idle_stablecoin_balance_q64,
                projected_apy_bps: 1_400,
                projected_risk_delta_bps: 50,
            },
        });
    }

    // 2. Defensive template recommendation under high churn.
    if inputs.rotation_frequency_per_30d >= 20 || inputs.withdrawal_burst_events_30d >= 3 {
        out.push(WalletRecommendation {
            kind: RecommendationKind::DefensiveTemplate,
            severity: "warn".into(),
            detail: "rotation frequency / withdrawal bursts above healthy band".into(),
            atlas_action: AtlasAction {
                vault_template: TemplateId::PusdTreasuryDefense,
                amount_q64: inputs.idle_stablecoin_balance_q64 / 2,
                projected_apy_bps: 800,
                projected_risk_delta_bps: -200,
            },
        });
    }

    // 3. Reduce concentration.
    if inputs.max_protocol_exposure_bps >= 7_000 {
        out.push(WalletRecommendation {
            kind: RecommendationKind::ReduceConcentration,
            severity: "warn".into(),
            detail: format!(
                "{}% of allocation in a single protocol",
                inputs.max_protocol_exposure_bps / 100
            ),
            atlas_action: AtlasAction {
                vault_template: TemplateId::PusdYieldBalanced,
                amount_q64: inputs.idle_stablecoin_balance_q64,
                projected_apy_bps: 1_200,
                projected_risk_delta_bps: -300,
            },
        });
    }

    // 4. Deleverage hint.
    if inputs.leverage_ratio_bps >= 5_000 {
        out.push(WalletRecommendation {
            kind: RecommendationKind::DeleverageHint,
            severity: "warn".into(),
            detail: "leverage ratio above policy guard".into(),
            atlas_action: AtlasAction {
                vault_template: TemplateId::PusdSafeYield,
                amount_q64: 0, // hint, not deposit
                projected_apy_bps: 1_400,
                projected_risk_delta_bps: -500,
            },
        });
    }

    out.truncate(MAX_RECOMMENDATIONS);
    out
}

/// Composite risk score in bps. Higher = riskier.
/// Weighted: leverage 40 %, concentration 30 %, rotation 20 %,
/// withdrawal burst 10 %.
pub fn compute_risk_score_bps(inputs: &ScoreInputs) -> u32 {
    let lev = inputs.leverage_ratio_bps.min(10_000) as u64;
    let conc = inputs.max_protocol_exposure_bps.min(10_000) as u64;
    let rot = ((inputs.rotation_frequency_per_30d * 200).min(10_000)) as u64;
    let burst = ((inputs.withdrawal_burst_events_30d * 1_000).min(10_000)) as u64;
    ((lev * 40 + conc * 30 + rot * 20 + burst * 10) / 100).min(10_000) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn idle_only() -> ScoreInputs {
        ScoreInputs {
            stablecoin_share_bps: 8_200,
            max_protocol_exposure_bps: 0,
            leverage_ratio_bps: 0,
            rotation_frequency_per_30d: 0,
            withdrawal_burst_events_30d: 0,
            idle_stablecoin_balance_q64: 1_000_000,
        }
    }

    #[test]
    fn idle_heavy_wallet_gets_safe_yield_rec() {
        let recs = score_wallet(&idle_only());
        assert_eq!(recs.len(), 1);
        assert_eq!(recs[0].kind, RecommendationKind::IdleCapital);
        assert_eq!(
            recs[0].atlas_action.vault_template,
            TemplateId::PusdSafeYield
        );
    }

    #[test]
    fn high_rotation_triggers_defensive() {
        let mut i = idle_only();
        i.rotation_frequency_per_30d = 30;
        let recs = score_wallet(&i);
        assert!(recs
            .iter()
            .any(|r| r.kind == RecommendationKind::DefensiveTemplate));
    }

    #[test]
    fn high_concentration_triggers_balanced() {
        let mut i = idle_only();
        i.max_protocol_exposure_bps = 8_500;
        let recs = score_wallet(&i);
        assert!(recs
            .iter()
            .any(|r| r.kind == RecommendationKind::ReduceConcentration));
    }

    #[test]
    fn recommendations_capped_at_three() {
        let i = ScoreInputs {
            stablecoin_share_bps: 8_200,
            max_protocol_exposure_bps: 8_500,
            leverage_ratio_bps: 6_000,
            rotation_frequency_per_30d: 30,
            withdrawal_burst_events_30d: 4,
            idle_stablecoin_balance_q64: 1_000_000,
        };
        let recs = score_wallet(&i);
        assert!(recs.len() <= MAX_RECOMMENDATIONS);
    }

    #[test]
    fn deterministic_for_same_inputs() {
        let a = score_wallet(&idle_only());
        let b = score_wallet(&idle_only());
        assert_eq!(a, b);
    }

    #[test]
    fn risk_score_clean_wallet_is_low() {
        let r = compute_risk_score_bps(&idle_only());
        assert!(r < 1_000, "got {r}");
    }

    #[test]
    fn risk_score_levered_concentrated_is_high() {
        let i = ScoreInputs {
            stablecoin_share_bps: 0,
            max_protocol_exposure_bps: 9_000,
            leverage_ratio_bps: 8_000,
            rotation_frequency_per_30d: 50,
            withdrawal_burst_events_30d: 5,
            idle_stablecoin_balance_q64: 0,
        };
        let r = compute_risk_score_bps(&i);
        assert!(r >= 7_000, "got {r}");
    }
}

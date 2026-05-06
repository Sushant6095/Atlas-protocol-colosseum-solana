//! Multi-wallet aggregation for treasury entities (directive §7).
//!
//! Treasuries are not single wallets. This module aggregates
//! exposure, risk, and behavior across a set of linked wallets and
//! produces the same `WalletIntelligenceReport` schema with
//! `wallet = entity_id` and a `subjects` list of pubkeys.
//!
//! Linking is read-only — it does not grant signing authority.

use crate::wallet_report::{
    compute_risk_score_bps, score_wallet, BehaviorMetrics, ExposureSummary,
    WalletIntelligenceReport, WalletRecommendation,
};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MultiWalletAggregate {
    pub entity_id: [u8; 32],
    pub subjects: Vec<Pubkey>,
    pub combined_balance_q64: u128,
    pub stablecoin_share_bps: u32,
    pub exposure: ExposureSummary,
    pub behavior: BehaviorMetrics,
    pub risk_score_bps: u32,
    pub recommendations: Vec<WalletRecommendation>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PerWalletInputs {
    pub wallet: Pubkey,
    pub balance_q64: u128,
    pub stablecoin_q64: u128,
    pub by_protocol_q64: BTreeMap<ProtocolKey, u128>,
    pub leverage_ratio_bps: u32,
    pub rotation_frequency_per_30d: u32,
    pub withdrawal_burst_events_30d: u32,
    pub tx_count_30d: u32,
}

pub type ProtocolKey = String;

/// Aggregate per-wallet inputs into a treasury-level report. Sums
/// notionals, weights leverage / rotation by balance, and runs the
/// shared `score_wallet` against the aggregated inputs.
pub fn aggregate_multi_wallet(
    entity_id: [u8; 32],
    rows: &[PerWalletInputs],
) -> MultiWalletAggregate {
    let total_balance: u128 = rows.iter().map(|r| r.balance_q64).sum();
    let total_stable: u128 = rows.iter().map(|r| r.stablecoin_q64).sum();
    let stable_share_bps = if total_balance == 0 {
        0
    } else {
        ((total_stable * 10_000) / total_balance).min(10_000) as u32
    };

    let mut by_protocol: BTreeMap<ProtocolKey, u128> = BTreeMap::new();
    for r in rows {
        for (k, v) in &r.by_protocol_q64 {
            *by_protocol.entry(k.clone()).or_insert(0) =
                by_protocol.get(k).copied().unwrap_or(0).saturating_add(*v);
        }
    }

    // Balance-weighted scalars.
    let mut weighted_lev: u128 = 0;
    let mut weighted_rot: u128 = 0;
    let mut weighted_burst: u128 = 0;
    let mut tx_count: u32 = 0;
    for r in rows {
        weighted_lev += (r.leverage_ratio_bps as u128) * r.balance_q64;
        weighted_rot += (r.rotation_frequency_per_30d as u128) * r.balance_q64;
        weighted_burst += (r.withdrawal_burst_events_30d as u128) * r.balance_q64;
        tx_count = tx_count.saturating_add(r.tx_count_30d);
    }
    let denom = total_balance.max(1);
    let leverage_ratio_bps = (weighted_lev / denom) as u32;
    let rotation = (weighted_rot / denom) as u32;
    let burst = (weighted_burst / denom) as u32;

    let max_protocol_exposure_bps = if total_balance == 0 {
        0
    } else {
        let max = by_protocol.values().copied().max().unwrap_or(0);
        ((max * 10_000) / total_balance).min(10_000) as u32
    };

    let by_protocol_bps: BTreeMap<String, u32> = by_protocol
        .iter()
        .map(|(k, v)| {
            let bps = if total_balance == 0 {
                0
            } else {
                ((*v * 10_000) / total_balance).min(10_000) as u32
            };
            (k.clone(), bps)
        })
        .collect();

    let exposure = ExposureSummary {
        by_protocol_bps,
        by_asset_bps: BTreeMap::new(),
        concentration_index_bps: max_protocol_exposure_bps,
        leverage_ratio_bps,
    };

    let inputs = crate::wallet_report::ScoreInputs {
        stablecoin_share_bps: stable_share_bps,
        max_protocol_exposure_bps,
        leverage_ratio_bps,
        rotation_frequency_per_30d: rotation,
        withdrawal_burst_events_30d: burst,
        idle_stablecoin_balance_q64: total_stable,
    };
    let recommendations = score_wallet(&inputs);
    let risk_score_bps = compute_risk_score_bps(&inputs);

    let behavior = BehaviorMetrics {
        tx_count_30d: tx_count,
        avg_hold_duration_days: 0,
        rotation_frequency_per_30d: rotation,
        withdrawal_burst_events_30d: burst,
    };

    MultiWalletAggregate {
        entity_id,
        subjects: rows.iter().map(|r| r.wallet).collect(),
        combined_balance_q64: total_balance,
        stablecoin_share_bps: stable_share_bps,
        exposure,
        behavior,
        risk_score_bps,
        recommendations,
    }
}

/// Adapt a `MultiWalletAggregate` into the canonical
/// `WalletIntelligenceReport` shape (with `wallet = entity_id`).
pub fn report_from_aggregate(
    agg: &MultiWalletAggregate,
    as_of_slot: u64,
    intelligence_sources: Vec<String>,
) -> WalletIntelligenceReport {
    WalletIntelligenceReport {
        schema: crate::wallet_report::REPORT_SCHEMA_V1.into(),
        wallet: agg.entity_id,
        as_of_slot,
        balances_by_bucket_q64: BTreeMap::new(),
        stablecoin_share_bps: agg.stablecoin_share_bps,
        exposure: agg.exposure.clone(),
        behavior: agg.behavior.clone(),
        risk_score_bps: agg.risk_score_bps,
        recommendations: agg.recommendations.clone(),
        generated_by: "atlas-intelligence".into(),
        intelligence_sources,
        verifiable_via: format!(
            "/api/v1/treasury/{}/intelligence",
            hex32(&agg.entity_id)
        ),
    }
}

fn hex32(b: &[u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn r(wallet: u8, total: u128, stable: u128, kamino: u128, lev: u32) -> PerWalletInputs {
        let mut by_protocol = BTreeMap::new();
        by_protocol.insert("kamino".into(), kamino);
        PerWalletInputs {
            wallet: [wallet; 32],
            balance_q64: total,
            stablecoin_q64: stable,
            by_protocol_q64: by_protocol,
            leverage_ratio_bps: lev,
            rotation_frequency_per_30d: 0,
            withdrawal_burst_events_30d: 0,
            tx_count_30d: 10,
        }
    }

    #[test]
    fn aggregates_sums_and_recomputes_share() {
        let rows = vec![r(1, 1_000, 800, 800, 2_000), r(2, 2_000, 1_000, 1_500, 4_000)];
        let agg = aggregate_multi_wallet([0xab; 32], &rows);
        assert_eq!(agg.combined_balance_q64, 3_000);
        // total stable 1_800 / 3_000 = 6_000 bps
        assert_eq!(agg.stablecoin_share_bps, 6_000);
        // weighted leverage: (2_000 * 1_000 + 4_000 * 2_000) / 3_000 = 3_333
        assert_eq!(agg.exposure.leverage_ratio_bps, 3_333);
        // by_protocol (kamino): 800 + 1_500 = 2_300 / 3_000 ≈ 7_666 bps
        assert!(agg.exposure.concentration_index_bps >= 7_500);
    }

    #[test]
    fn empty_rows_yield_zero_aggregate() {
        let agg = aggregate_multi_wallet([0u8; 32], &[]);
        assert_eq!(agg.combined_balance_q64, 0);
        assert_eq!(agg.stablecoin_share_bps, 0);
    }

    #[test]
    fn high_concentration_triggers_recommendation() {
        let rows = vec![r(1, 10_000, 8_000, 8_500, 2_000)];
        let agg = aggregate_multi_wallet([0u8; 32], &rows);
        assert!(agg
            .recommendations
            .iter()
            .any(|x| x.kind == crate::wallet_report::RecommendationKind::ReduceConcentration));
    }

    #[test]
    fn report_adapter_pins_schema_and_wallet() {
        let rows = vec![r(1, 1_000, 800, 100, 0)];
        let agg = aggregate_multi_wallet([0xab; 32], &rows);
        let report = report_from_aggregate(&agg, 100, vec!["dune-sim:exec_x".into()]);
        assert_eq!(report.schema, "atlas.wallet_intel.v1");
        assert_eq!(report.wallet, [0xab; 32]);
        assert!(report.verifiable_via.contains("/treasury/"));
    }
}

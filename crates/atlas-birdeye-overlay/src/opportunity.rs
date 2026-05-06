//! Opportunity scanner (directive §3.2).
//!
//! Joins Birdeye yield + liquidity data with the Atlas warehouse and
//! produces ranked `YieldOpportunity` rows for new vault creation.
//! Existing vaults are unaffected.

use atlas_failure::class::{AssetId, ProtocolId};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RationaleClause {
    StableApy,
    DeepLiquidity,
    LowToxicity,
    HolderDispersion,
    BirdeyeFlagClean,
    SmartMoneyInflow,
    HighVolatility,
    Concentration,
    BirdeyeRiskFlag,
    // Phase 11 §6 — Dune-derived evidence rows. Vault-creation only;
    // never an existing-vault rebalance input.
    DuneProtocolInflowVelocity,
    DuneCrossChainMigrationLeading,
    DuneHistoricalDrawdownDeep,
}

impl RationaleClause {
    /// True iff the clause comes from a Dune snapshot. Used by the
    /// scanner to inject the snapshot id into the opportunity row's
    /// provenance footer.
    pub const fn is_dune_sourced(self) -> bool {
        matches!(
            self,
            RationaleClause::DuneProtocolInflowVelocity
                | RationaleClause::DuneCrossChainMigrationLeading
                | RationaleClause::DuneHistoricalDrawdownDeep
        )
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct StructuredRationale {
    pub positives: Vec<RationaleClause>,
    pub negatives: Vec<RationaleClause>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct YieldOpportunity {
    pub asset: AssetId,
    pub protocol: ProtocolId,
    pub apy_bps_30d: u32,
    pub apy_volatility_bps: u32,
    /// Composite of depth + fragmentation + age + holder dispersion.
    pub liquidity_quality_bps: u32,
    /// From Phase 04 dependency graph + Birdeye risk flags.
    pub risk_score_bps: u32,
    /// Sharpe-like risk-adjusted yield score.
    pub score_bps: u32,
    pub eligible_for_universe: bool,
    pub rationale: StructuredRationale,
}

/// Score = `apy / max(volatility, 1) * liquidity_quality / max(risk, 1)`.
/// Returns the input list sorted descending by `score_bps` and with
/// `eligible_for_universe` flipped on for the top-quartile entries
/// (purely a recommendation; vault creation is governance-driven).
pub fn rank_opportunities(mut rows: Vec<YieldOpportunity>) -> Vec<YieldOpportunity> {
    for r in rows.iter_mut() {
        r.score_bps = score(r);
    }
    rows.sort_by(|a, b| b.score_bps.cmp(&a.score_bps));
    let cutoff = rows.len() / 4;
    for (i, r) in rows.iter_mut().enumerate() {
        r.eligible_for_universe = i < cutoff && r.risk_score_bps < 5_000;
    }
    rows
}

fn score(r: &YieldOpportunity) -> u32 {
    let apy = r.apy_bps_30d as u64;
    let vol = r.apy_volatility_bps.max(1) as u64;
    let lq = r.liquidity_quality_bps as u64;
    let risk = r.risk_score_bps.max(1) as u64;
    // Scale lq + apy / vol / risk; clamp into u32.
    let raw = (apy * lq) / (vol * risk);
    raw.min(u32::MAX as u64) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opp(apy: u32, vol: u32, lq: u32, risk: u32) -> YieldOpportunity {
        YieldOpportunity {
            asset: AssetId(1),
            protocol: ProtocolId(2),
            apy_bps_30d: apy,
            apy_volatility_bps: vol,
            liquidity_quality_bps: lq,
            risk_score_bps: risk,
            score_bps: 0,
            eligible_for_universe: false,
            rationale: StructuredRationale::default(),
        }
    }

    #[test]
    fn risk_adjusted_score_beats_raw_apy() {
        let rows = vec![
            opp(500, 200, 8_000, 2_000),  // high apy, low risk
            opp(400, 200, 8_000, 2_000),  // lower apy, low risk
            opp(600, 200, 8_000, 7_000),  // high apy, high risk
        ];
        let ranked = rank_opportunities(rows);
        // The 500-apy / low-risk row beats the 600-apy / high-risk row
        // because the risk denominator drags the score.
        assert_eq!(ranked[0].apy_bps_30d, 500);
        assert!(ranked[0].score_bps >= ranked[1].score_bps);
        assert!(ranked[1].score_bps >= ranked[2].score_bps);
    }

    #[test]
    fn high_volatility_drags_score() {
        let stable = opp(500, 100, 8_000, 1_000);
        let volatile = opp(500, 1_000, 8_000, 1_000);
        let ranked = rank_opportunities(vec![stable, volatile]);
        assert!(ranked[0].apy_volatility_bps < ranked[1].apy_volatility_bps);
    }

    #[test]
    fn risky_rows_flagged_ineligible() {
        let r = vec![
            opp(500, 100, 8_000, 9_000), // risk above 5_000 → ineligible
            opp(500, 100, 8_000, 1_000),
            opp(400, 100, 8_000, 1_000),
            opp(300, 100, 8_000, 1_000),
        ];
        let ranked = rank_opportunities(r);
        assert!(!ranked.iter().any(|x| x.eligible_for_universe && x.risk_score_bps >= 5_000));
    }

    #[test]
    fn dune_sourced_predicate_partitions_clauses() {
        for c in [
            RationaleClause::StableApy,
            RationaleClause::DeepLiquidity,
            RationaleClause::LowToxicity,
            RationaleClause::HolderDispersion,
            RationaleClause::BirdeyeFlagClean,
            RationaleClause::SmartMoneyInflow,
            RationaleClause::HighVolatility,
            RationaleClause::Concentration,
            RationaleClause::BirdeyeRiskFlag,
        ] {
            assert!(!c.is_dune_sourced(), "{c:?} should not be Dune-sourced");
        }
        for c in [
            RationaleClause::DuneProtocolInflowVelocity,
            RationaleClause::DuneCrossChainMigrationLeading,
            RationaleClause::DuneHistoricalDrawdownDeep,
        ] {
            assert!(c.is_dune_sourced(), "{c:?} should be Dune-sourced");
        }
    }

    #[test]
    fn dune_evidence_lands_in_rationale_without_changing_schema() {
        let mut o = opp(500, 100, 8_000, 1_000);
        o.rationale.positives.push(RationaleClause::DuneProtocolInflowVelocity);
        o.rationale.positives.push(RationaleClause::DuneCrossChainMigrationLeading);
        o.rationale.negatives.push(RationaleClause::DuneHistoricalDrawdownDeep);
        // Round-trip serde: the schema accepts the new variants verbatim.
        let s = serde_json::to_string(&o).unwrap();
        let back: YieldOpportunity = serde_json::from_str(&s).unwrap();
        assert_eq!(o, back);
    }
}

//! Stage 04 — PreprocessRisk.
//!
//! Live risk topology — replaces static per-protocol risk constants. Built
//! per-rebalance from the snapshot. Outputs `RiskTopology`, hashed into
//! `public_input.risk_state_hash`.
//!
//! Components (directive §8):
//!   - Contagion graph: directed edges weighted by shared collateral, oracle,
//!     or liquidator. Recompute per rebalance.
//!   - Oracle dependency map: which protocols share which feeds; deviation in
//!     a shared feed propagates risk to all dependents.
//!   - Correlated-liquidation model: simulate `-X%` shock, return cumulative
//!     loss across the portfolio.
//!   - Liquidity-collapse forecast: project withdrawal queue depth vs.
//!     available liquidity over 24h under three scenarios.
//!
//! Emergency triggers (any one → defensive mode for this rebalance):
//!   1. volatility_30m > 3 × volatility_30d_median
//!   2. oracle_deviation > 50 bps on any active feed
//!   3. proof age > MAX_STALE_SLOTS / 2 projected at submission
//!   4. protocol TVL drop > 20% in 1h
//!   5. consensus disagreement > τ_disagree_emergency (default 0.30)

use crate::hashing::{hash_with_tag, merkle_with_tag, tags};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ProtocolId(pub u8);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct OracleId(pub u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum ContagionEdgeKind {
    SharedCollateral = 0,
    SharedOracle = 1,
    SharedLiquidator = 2,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ContagionEdge {
    pub from: ProtocolId,
    pub to: ProtocolId,
    pub kind: ContagionEdgeKind,
    /// Weight in bps `[0, 10_000]` — share of risk transmitted across this edge.
    pub weight_bps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContagionGraph {
    /// Sorted by `(from, to, kind)` for I-6 deterministic hashing.
    pub edges: Vec<ContagionEdge>,
}

impl ContagionGraph {
    pub fn new(mut edges: Vec<ContagionEdge>) -> Self {
        edges.sort();
        edges.dedup();
        Self { edges }
    }

    pub fn root(&self) -> [u8; 32] {
        let leaves: Vec<[u8; 32]> = self
            .edges
            .iter()
            .map(|e| {
                hash_with_tag(
                    tags::RISK_V2,
                    &[
                        &[e.from.0],
                        &[e.to.0],
                        &[e.kind as u8],
                        &e.weight_bps.to_le_bytes(),
                    ],
                )
            })
            .collect();
        merkle_with_tag(tags::RISK_V2, &leaves)
    }
}

/// Maps each oracle feed → set of protocols depending on it. A deviation on
/// `feed_id` propagates to every protocol in `protocols`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OracleDependencyMap {
    pub by_oracle: BTreeMap<OracleId, Vec<ProtocolId>>,
}

impl OracleDependencyMap {
    pub fn new(by_oracle: BTreeMap<OracleId, Vec<ProtocolId>>) -> Self {
        let mut clean = BTreeMap::new();
        for (oid, mut ps) in by_oracle.into_iter() {
            ps.sort();
            ps.dedup();
            clean.insert(oid, ps);
        }
        Self { by_oracle: clean }
    }

    pub fn protocols_affected(&self, feed: OracleId) -> &[ProtocolId] {
        self.by_oracle.get(&feed).map(|v| v.as_slice()).unwrap_or(&[])
    }

    pub fn root(&self) -> [u8; 32] {
        let mut leaves = Vec::with_capacity(self.by_oracle.len());
        for (oid, ps) in &self.by_oracle {
            let mut bytes = Vec::with_capacity(4 + ps.len());
            bytes.extend_from_slice(&oid.0.to_le_bytes());
            for p in ps {
                bytes.push(p.0);
            }
            leaves.push(hash_with_tag(tags::RISK_V2, &[&bytes]));
        }
        merkle_with_tag(tags::RISK_V2, &leaves)
    }
}

/// Per-protocol exposure used by the correlated-liquidation simulator.
#[derive(Clone, Copy, Debug)]
pub struct ProtocolExposure {
    pub protocol: ProtocolId,
    /// Vault notional deployed in this protocol, in bps of NAV.
    pub notional_bps: u32,
    /// Sensitivity to a `-X%` shock — bps of position lost per bps of shock.
    /// 10_000 = full delta-1 exposure. Higher than 10_000 = leveraged.
    pub leverage_bps: u32,
}

/// Cumulative loss in bps when `shock_bps` is applied to every leg.
pub fn correlated_liquidation_loss(exposures: &[ProtocolExposure], shock_bps: u32) -> u64 {
    let mut total: u64 = 0;
    for e in exposures {
        // loss = notional_bps × shock_bps × leverage_bps  (scaled by 1e8)
        let notional = e.notional_bps as u128;
        let shock = shock_bps as u128;
        let lev = e.leverage_bps as u128;
        // Floor-divide; matches integer guest path.
        let loss = (notional * shock * lev) / 100_000_000u128;
        total = total.saturating_add(loss as u64);
    }
    total
}

/// Liquidity scenarios used by the 24h collapse forecast.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum LiquidityScenario {
    Calm = 0,
    Stressed = 1,
    Crisis = 2,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LiquidityForecast {
    pub scenario: LiquidityScenario,
    /// Projected withdrawal queue at the end of the 24h window (bps of NAV).
    pub queue_bps_24h: u32,
    /// Projected available liquidity at the end of the 24h window (bps of NAV).
    pub available_bps_24h: u32,
}

impl LiquidityForecast {
    /// Coverage = available / queue. ≥10_000 means fully covered.
    pub fn coverage_bps(&self) -> u32 {
        if self.queue_bps_24h == 0 {
            return u32::MAX.min(20_000);
        }
        ((self.available_bps_24h as u64).saturating_mul(10_000)
            / self.queue_bps_24h as u64) as u32
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RiskTopology {
    pub contagion: ContagionGraph,
    pub oracle_deps: OracleDependencyMap,
    /// Sorted by scenario discriminant.
    pub liquidity_forecasts: Vec<LiquidityForecast>,
    /// Output of the correlated-liquidation model at three reference shocks.
    pub liquidation_loss_500bps: u64,
    pub liquidation_loss_1000bps: u64,
    pub liquidation_loss_2000bps: u64,
    pub risk_state_hash: [u8; 32],
}

impl RiskTopology {
    pub fn build(
        contagion: ContagionGraph,
        oracle_deps: OracleDependencyMap,
        mut liquidity_forecasts: Vec<LiquidityForecast>,
        exposures: &[ProtocolExposure],
    ) -> Self {
        liquidity_forecasts.sort_by_key(|f| f.scenario as u8);
        liquidity_forecasts.dedup_by_key(|f| f.scenario as u8);

        let liquidation_loss_500bps = correlated_liquidation_loss(exposures, 500);
        let liquidation_loss_1000bps = correlated_liquidation_loss(exposures, 1_000);
        let liquidation_loss_2000bps = correlated_liquidation_loss(exposures, 2_000);

        let mut leaves: Vec<[u8; 32]> = Vec::new();
        leaves.push(contagion.root());
        leaves.push(oracle_deps.root());
        for f in &liquidity_forecasts {
            leaves.push(hash_with_tag(
                tags::RISK_V2,
                &[
                    &[f.scenario as u8],
                    &f.queue_bps_24h.to_le_bytes(),
                    &f.available_bps_24h.to_le_bytes(),
                ],
            ));
        }
        leaves.push(hash_with_tag(
            tags::RISK_V2,
            &[
                &liquidation_loss_500bps.to_le_bytes(),
                &liquidation_loss_1000bps.to_le_bytes(),
                &liquidation_loss_2000bps.to_le_bytes(),
            ],
        ));
        let risk_state_hash = merkle_with_tag(tags::RISK_V2, &leaves);

        Self {
            contagion,
            oracle_deps,
            liquidity_forecasts,
            liquidation_loss_500bps,
            liquidation_loss_1000bps,
            liquidation_loss_2000bps,
            risk_state_hash,
        }
    }
}

// ─── Emergency triggers ───────────────────────────────────────────────────

pub const TAU_DISAGREE_EMERGENCY_BPS: u32 = 3_000;
pub const ORACLE_DEVIATION_EMERGENCY_BPS: u32 = 50;
pub const TVL_DROP_EMERGENCY_BPS_PER_HOUR: u32 = 2_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EmergencyTrigger {
    VolatilitySpike { multiple_of_median: u32 }, // bps; 30_000 = 3.0×
    OracleDeviation { feed: OracleId, deviation_bps: u32 },
    ProofAgeProjected { projected_slots: u64, max_stale_slots: u64 },
    TvlCrash { protocol: ProtocolId, drop_bps_1h: u32 },
    ConsensusDisagreement { disagreement_bps: u32 },
}

#[derive(Clone, Debug, Default)]
pub struct EmergencyInput {
    pub volatility_30m_bps: u32,
    pub volatility_30d_median_bps: u32,
    pub oracle_deviations: Vec<(OracleId, u32)>,
    pub projected_proof_age_slots: u64,
    pub max_stale_slots: u64,
    pub tvl_drops_1h: Vec<(ProtocolId, u32)>,
    pub consensus_disagreement_bps: u32,
}

/// Returns the *first* trigger encountered in deterministic order. Caller can
/// short-circuit to defensive mode on `Some(...)`.
pub fn evaluate_emergency_triggers(input: &EmergencyInput) -> Option<EmergencyTrigger> {
    // 1. Volatility spike — 3× median.
    if input.volatility_30d_median_bps > 0 {
        let multiple_bps =
            (input.volatility_30m_bps as u64 * 10_000 / input.volatility_30d_median_bps as u64) as u32;
        if multiple_bps > 30_000 {
            return Some(EmergencyTrigger::VolatilitySpike { multiple_of_median: multiple_bps });
        }
    }

    // 2. Oracle deviation > 50 bps.
    let mut oracles = input.oracle_deviations.clone();
    oracles.sort_by_key(|(o, _)| o.0);
    for (feed, dev) in oracles {
        if dev > ORACLE_DEVIATION_EMERGENCY_BPS {
            return Some(EmergencyTrigger::OracleDeviation { feed, deviation_bps: dev });
        }
    }

    // 3. Proof age projected past half the staleness window.
    if input.max_stale_slots > 0 && input.projected_proof_age_slots > input.max_stale_slots / 2 {
        return Some(EmergencyTrigger::ProofAgeProjected {
            projected_slots: input.projected_proof_age_slots,
            max_stale_slots: input.max_stale_slots,
        });
    }

    // 4. TVL crash > 20% in 1h, sorted by protocol id.
    let mut drops = input.tvl_drops_1h.clone();
    drops.sort_by_key(|(p, _)| p.0);
    for (protocol, drop) in drops {
        if drop >= TVL_DROP_EMERGENCY_BPS_PER_HOUR {
            return Some(EmergencyTrigger::TvlCrash { protocol, drop_bps_1h: drop });
        }
    }

    // 5. Consensus disagreement above emergency threshold.
    if input.consensus_disagreement_bps > TAU_DISAGREE_EMERGENCY_BPS {
        return Some(EmergencyTrigger::ConsensusDisagreement {
            disagreement_bps: input.consensus_disagreement_bps,
        });
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn correlated_liquidation_zero_for_empty() {
        assert_eq!(correlated_liquidation_loss(&[], 1_000), 0);
    }

    #[test]
    fn correlated_liquidation_scales_linearly() {
        let exposures = vec![ProtocolExposure {
            protocol: ProtocolId(1),
            notional_bps: 10_000,
            leverage_bps: 10_000,
        }];
        let loss_500 = correlated_liquidation_loss(&exposures, 500);
        let loss_1000 = correlated_liquidation_loss(&exposures, 1_000);
        // 500 → 5_000_000 (notional 10k × shock 500 × lev 10k / 1e8 = 5)... let me do math:
        // 10_000 * 500 * 10_000 = 5 * 10^10; /1e8 = 500
        // 10_000 * 1000 * 10_000 = 1e11; /1e8 = 1000
        assert_eq!(loss_500, 500);
        assert_eq!(loss_1000, 1_000);
        assert_eq!(loss_1000, loss_500 * 2);
    }

    #[test]
    fn contagion_root_order_invariant() {
        let e1 = ContagionEdge {
            from: ProtocolId(1),
            to: ProtocolId(2),
            kind: ContagionEdgeKind::SharedCollateral,
            weight_bps: 5_000,
        };
        let e2 = ContagionEdge {
            from: ProtocolId(2),
            to: ProtocolId(3),
            kind: ContagionEdgeKind::SharedOracle,
            weight_bps: 3_000,
        };
        let g1 = ContagionGraph::new(vec![e1, e2]);
        let g2 = ContagionGraph::new(vec![e2, e1]);
        assert_eq!(g1.root(), g2.root());
    }

    #[test]
    fn oracle_map_protocols_affected() {
        let mut m = BTreeMap::new();
        m.insert(OracleId(42), vec![ProtocolId(1), ProtocolId(2), ProtocolId(2)]);
        let map = OracleDependencyMap::new(m);
        let affected = map.protocols_affected(OracleId(42));
        assert_eq!(affected.len(), 2); // dedup
        assert!(map.protocols_affected(OracleId(99)).is_empty());
    }

    #[test]
    fn risk_state_hash_changes_on_edge_diff() {
        let g1 = ContagionGraph::new(vec![ContagionEdge {
            from: ProtocolId(1),
            to: ProtocolId(2),
            kind: ContagionEdgeKind::SharedCollateral,
            weight_bps: 5_000,
        }]);
        let g2 = ContagionGraph::new(vec![ContagionEdge {
            from: ProtocolId(1),
            to: ProtocolId(2),
            kind: ContagionEdgeKind::SharedCollateral,
            weight_bps: 5_001,
        }]);
        let m = OracleDependencyMap::new(BTreeMap::new());
        let r1 = RiskTopology::build(g1, m.clone(), vec![], &[]);
        let r2 = RiskTopology::build(g2, m, vec![], &[]);
        assert_ne!(r1.risk_state_hash, r2.risk_state_hash);
    }

    #[test]
    fn liquidity_forecast_coverage_handles_zero_queue() {
        let f = LiquidityForecast {
            scenario: LiquidityScenario::Calm,
            queue_bps_24h: 0,
            available_bps_24h: 5_000,
        };
        assert!(f.coverage_bps() >= 10_000);
    }

    #[test]
    fn emergency_volatility_spike_detected() {
        let input = EmergencyInput {
            volatility_30m_bps: 9_000,
            volatility_30d_median_bps: 2_500,
            ..Default::default()
        };
        match evaluate_emergency_triggers(&input) {
            Some(EmergencyTrigger::VolatilitySpike { .. }) => {}
            other => panic!("expected VolatilitySpike, got {:?}", other),
        }
    }

    #[test]
    fn emergency_oracle_deviation_above_50_bps() {
        let input = EmergencyInput {
            oracle_deviations: vec![(OracleId(7), 75)],
            ..Default::default()
        };
        match evaluate_emergency_triggers(&input) {
            Some(EmergencyTrigger::OracleDeviation { feed, deviation_bps }) => {
                assert_eq!(feed, OracleId(7));
                assert_eq!(deviation_bps, 75);
            }
            other => panic!("expected OracleDeviation, got {:?}", other),
        }
    }

    #[test]
    fn emergency_proof_age_projected() {
        let input = EmergencyInput {
            projected_proof_age_slots: 100,
            max_stale_slots: 150,
            ..Default::default()
        };
        // 100 > 75 (half of 150) → trigger
        assert!(matches!(
            evaluate_emergency_triggers(&input),
            Some(EmergencyTrigger::ProofAgeProjected { .. })
        ));
    }

    #[test]
    fn emergency_tvl_drop_protocol_crash() {
        let input = EmergencyInput {
            tvl_drops_1h: vec![(ProtocolId(3), 2_500)],
            ..Default::default()
        };
        assert!(matches!(
            evaluate_emergency_triggers(&input),
            Some(EmergencyTrigger::TvlCrash { .. })
        ));
    }

    #[test]
    fn emergency_consensus_disagreement() {
        let input = EmergencyInput {
            consensus_disagreement_bps: 3_500,
            ..Default::default()
        };
        assert!(matches!(
            evaluate_emergency_triggers(&input),
            Some(EmergencyTrigger::ConsensusDisagreement { .. })
        ));
    }

    #[test]
    fn no_trigger_under_normal_conditions() {
        let input = EmergencyInput {
            volatility_30m_bps: 2_000,
            volatility_30d_median_bps: 2_500,
            oracle_deviations: vec![(OracleId(7), 25)],
            projected_proof_age_slots: 30,
            max_stale_slots: 150,
            tvl_drops_1h: vec![(ProtocolId(3), 500)],
            consensus_disagreement_bps: 800,
        };
        assert!(evaluate_emergency_triggers(&input).is_none());
    }
}

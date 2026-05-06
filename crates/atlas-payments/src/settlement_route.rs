//! Dodo as a settlement route + multi-stable settlement guards
//! (directive §7 + §8).
//!
//! Phase 09 §4 defines the *execution* route registry (Jito / SwQoS /
//! DFlow). Phase 13 adds a separate *settlement* route registry for
//! outbound payouts. A payout's route is recorded in the rebalance
//! black box (Phase 05 §3); the Dodo settlement reference joins to
//! the on-chain debit in the warehouse for unified audit.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SettlementRouteId {
    /// Dodo originates a fiat / cross-border settlement on the
    /// recipient's preferred currency.
    Dodo,
    /// Direct on-chain SPL transfer in the same mint.
    OnchainTransfer,
    /// Cross-stable swap then Dodo settle.
    OnchainSwapThenDodo,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentIntent {
    pub intent_id: String,
    pub treasury_id: Pubkey,
    pub recipient_ref_hash: [u8; 32],
    pub amount_q64: u128,
    pub source_mint: Pubkey,
    pub target_currency: String,
    pub region: String,
    pub latest_at_slot: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementQuote {
    pub route: SettlementRouteId,
    pub fee_bps: u32,
    pub fx_cost_bps: u32,
    pub expected_settlement_lag_slots: u64,
    /// True iff the route's region restriction permits this intent.
    pub region_permitted: bool,
    /// Peg deviation (bps) on any required swap leg. 0 if no swap.
    pub leg_peg_deviation_bps: u32,
}

impl SettlementQuote {
    pub fn total_cost_bps(&self) -> u32 {
        self.fee_bps.saturating_add(self.fx_cost_bps)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettlementReceipt {
    pub route: SettlementRouteId,
    pub atlas_payment_id: [u8; 32],
    /// Free-form reference Dodo (or the on-chain receipt) returned;
    /// the warehouse joins it to the on-chain debit for audit.
    pub external_reference: String,
    pub settled_at_slot: u64,
    pub fee_paid_q64: u128,
}

/// Trait every settlement route implements.
pub trait SettlementRoute: Send + Sync {
    fn route_id(&self) -> SettlementRouteId;
    fn supports(&self, intent: &PaymentIntent) -> bool;
    fn quote(&self, intent: &PaymentIntent) -> SettlementQuote;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct DodoSettlementRoute {
    /// Dodo's published average-time-to-settle in slots for this region.
    pub typical_lag_slots: u64,
    pub fee_bps: u32,
    pub fx_cost_bps: u32,
    pub region_supported: bool,
}

impl SettlementRoute for DodoSettlementRoute {
    fn route_id(&self) -> SettlementRouteId { SettlementRouteId::Dodo }
    fn supports(&self, _intent: &PaymentIntent) -> bool { self.region_supported }
    fn quote(&self, _intent: &PaymentIntent) -> SettlementQuote {
        SettlementQuote {
            route: SettlementRouteId::Dodo,
            fee_bps: self.fee_bps,
            fx_cost_bps: self.fx_cost_bps,
            expected_settlement_lag_slots: self.typical_lag_slots,
            region_permitted: self.region_supported,
            leg_peg_deviation_bps: 0,
        }
    }
}

/// Multi-stable settlement guards (directive §8).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MultiStableSettlementOptions {
    pub quotes: Vec<SettlementQuote>,
    /// Peg-deviation threshold; quotes whose `leg_peg_deviation_bps`
    /// exceed this are filtered out and the operator sees the
    /// `deferred_due_to_peg` flag.
    pub tau_peg_swap_bps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PickedSettlement {
    pub winner: SettlementQuote,
    pub deferred_due_to_peg: Vec<SettlementQuote>,
    /// True iff every viable route is past the intent's
    /// `latest_at_slot` window — operator must intervene.
    pub deadline_at_risk: bool,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum SettlementSelectError {
    #[error("no quotes supplied")]
    NoQuotes,
    #[error("every route filtered out by peg-deviation guard")]
    AllPeggedOut,
    #[error("no route's region restriction permits this intent")]
    RegionUnsupported,
}

/// Pick the settlement winner for a `PaymentIntent`. Filters by:
///
/// 1. region permission,
/// 2. peg-deviation gate (`leg_peg_deviation_bps ≤ tau_peg_swap_bps`),
/// 3. minimum total cost (fee + FX).
///
/// Routes filtered by the peg gate surface in `deferred_due_to_peg`.
/// `deadline_at_risk` is set true when the chosen route's
/// `expected_settlement_lag_slots` would push past the intent's
/// `latest_at_slot` band.
pub fn pick_settlement(
    intent: &PaymentIntent,
    current_slot: u64,
    options: &MultiStableSettlementOptions,
) -> Result<PickedSettlement, SettlementSelectError> {
    if options.quotes.is_empty() {
        return Err(SettlementSelectError::NoQuotes);
    }
    let region_filtered: Vec<&SettlementQuote> = options
        .quotes
        .iter()
        .filter(|q| q.region_permitted)
        .collect();
    if region_filtered.is_empty() {
        return Err(SettlementSelectError::RegionUnsupported);
    }
    let mut deferred: Vec<SettlementQuote> = Vec::new();
    let mut viable: Vec<&SettlementQuote> = Vec::new();
    for q in region_filtered {
        if q.leg_peg_deviation_bps > options.tau_peg_swap_bps {
            deferred.push(q.clone());
        } else {
            viable.push(q);
        }
    }
    if viable.is_empty() {
        return Err(SettlementSelectError::AllPeggedOut);
    }
    let winner = viable
        .iter()
        .min_by_key(|q| q.total_cost_bps())
        .copied()
        .cloned()
        .unwrap_or_else(|| viable[0].clone());
    let deadline_at_risk = current_slot
        .saturating_add(winner.expected_settlement_lag_slots)
        > intent.latest_at_slot;
    Ok(PickedSettlement {
        winner,
        deferred_due_to_peg: deferred,
        deadline_at_risk,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn intent(latest: u64) -> PaymentIntent {
        PaymentIntent {
            intent_id: "pay_1".into(),
            treasury_id: [1u8; 32],
            recipient_ref_hash: [2u8; 32],
            amount_q64: 5_000,
            source_mint: [3u8; 32],
            target_currency: "USDC".into(),
            region: "US".into(),
            latest_at_slot: latest,
        }
    }

    fn quote(route: SettlementRouteId, fee: u32, fx: u32, peg: u32, region: bool, lag: u64) -> SettlementQuote {
        SettlementQuote {
            route,
            fee_bps: fee,
            fx_cost_bps: fx,
            expected_settlement_lag_slots: lag,
            region_permitted: region,
            leg_peg_deviation_bps: peg,
        }
    }

    #[test]
    fn picks_lowest_total_cost() {
        let opts = MultiStableSettlementOptions {
            quotes: vec![
                quote(SettlementRouteId::Dodo, 30, 20, 0, true, 100),
                quote(SettlementRouteId::OnchainSwapThenDodo, 10, 10, 30, true, 200),
                quote(SettlementRouteId::OnchainTransfer, 5, 0, 0, true, 50),
            ],
            tau_peg_swap_bps: 50,
        };
        let r = pick_settlement(&intent(10_000), 0, &opts).unwrap();
        assert_eq!(r.winner.route, SettlementRouteId::OnchainTransfer);
    }

    #[test]
    fn peg_gate_filters_volatile_routes() {
        let opts = MultiStableSettlementOptions {
            quotes: vec![
                quote(SettlementRouteId::OnchainSwapThenDodo, 10, 10, 80, true, 200),
                quote(SettlementRouteId::Dodo, 30, 20, 0, true, 100),
            ],
            tau_peg_swap_bps: 50,
        };
        let r = pick_settlement(&intent(10_000), 0, &opts).unwrap();
        assert_eq!(r.winner.route, SettlementRouteId::Dodo);
        assert_eq!(r.deferred_due_to_peg.len(), 1);
    }

    #[test]
    fn region_unsupported_rejects() {
        let opts = MultiStableSettlementOptions {
            quotes: vec![quote(SettlementRouteId::Dodo, 30, 20, 0, false, 100)],
            tau_peg_swap_bps: 50,
        };
        let r = pick_settlement(&intent(10_000), 0, &opts);
        assert_eq!(r, Err(SettlementSelectError::RegionUnsupported));
    }

    #[test]
    fn all_routes_pegged_out_rejects() {
        let opts = MultiStableSettlementOptions {
            quotes: vec![quote(SettlementRouteId::OnchainSwapThenDodo, 10, 10, 80, true, 200)],
            tau_peg_swap_bps: 50,
        };
        let r = pick_settlement(&intent(10_000), 0, &opts);
        assert_eq!(r, Err(SettlementSelectError::AllPeggedOut));
    }

    #[test]
    fn deadline_at_risk_flag_set() {
        let opts = MultiStableSettlementOptions {
            quotes: vec![quote(SettlementRouteId::Dodo, 30, 20, 0, true, 5_000)],
            tau_peg_swap_bps: 50,
        };
        let r = pick_settlement(&intent(1_000), 0, &opts).unwrap();
        assert!(r.deadline_at_risk);
    }

    #[test]
    fn no_quotes_rejects() {
        let opts = MultiStableSettlementOptions {
            quotes: vec![],
            tau_peg_swap_bps: 50,
        };
        let r = pick_settlement(&intent(0), 0, &opts);
        assert_eq!(r, Err(SettlementSelectError::NoQuotes));
    }

    #[test]
    fn dodo_route_quotes_with_published_lag() {
        let route = DodoSettlementRoute {
            typical_lag_slots: 100,
            fee_bps: 30,
            fx_cost_bps: 20,
            region_supported: true,
        };
        let q = route.quote(&intent(10_000));
        assert_eq!(q.expected_settlement_lag_slots, 100);
        assert_eq!(q.total_cost_bps(), 50);
    }
}

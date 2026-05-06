//! `ExecutionRoute` trait + the three concrete shapes.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RouteId {
    Jito,
    SwQos,
    Dflow,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlannedLeg {
    pub leg_index: u32,
    pub source_mint: Pubkey,
    pub dest_mint: Pubkey,
    pub notional_q64: u128,
    /// True iff the leg is a swap that exposes Atlas to MEV. Drives
    /// DFlow eligibility.
    pub mev_sensitive: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Quote {
    pub route: RouteId,
    pub expected_slippage_bps: u32,
    pub fee_lamports: u64,
    pub valid_until_slot: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RouteReceipt {
    pub route: RouteId,
    pub bundle_id: [u8; 32],
    pub landed_slot: u64,
    pub observed_slippage_bps: u32,
    pub cost_lamports: u64,
}

pub trait ExecutionRoute: Send + Sync {
    fn quote(&self, leg: &PlannedLeg) -> Quote;
    fn supports(&self, leg: &PlannedLeg) -> bool;
    fn route_id(&self) -> RouteId;
}

// ── Jito Block Engine route ─────────────────────────────────────────

#[derive(Clone, Debug, Default)]
pub struct JitoRoute;

impl ExecutionRoute for JitoRoute {
    fn quote(&self, leg: &PlannedLeg) -> Quote {
        // Jito: no extra slippage protection beyond bundle atomicity.
        // Quote slippage from observed pool depth (caller has already
        // priced this) — here we just echo.
        Quote {
            route: RouteId::Jito,
            expected_slippage_bps: 25,
            fee_lamports: 5_000,
            valid_until_slot: 0,
        }
        .with_leg(leg)
    }
    fn supports(&self, _leg: &PlannedLeg) -> bool { true }
    fn route_id(&self) -> RouteId { RouteId::Jito }
}

// ── SWQoS validator path ────────────────────────────────────────────

#[derive(Clone, Debug, Default)]
pub struct SwqosRoute;

impl ExecutionRoute for SwqosRoute {
    fn quote(&self, leg: &PlannedLeg) -> Quote {
        Quote {
            route: RouteId::SwQos,
            expected_slippage_bps: 25,
            fee_lamports: 3_000,
            valid_until_slot: 0,
        }
        .with_leg(leg)
    }
    fn supports(&self, _leg: &PlannedLeg) -> bool { true }
    fn route_id(&self) -> RouteId { RouteId::SwQos }
}

// ── DFlow MEV-protected order flow auction ──────────────────────────

#[derive(Clone, Debug, Default)]
pub struct DflowRoute;

impl ExecutionRoute for DflowRoute {
    fn quote(&self, leg: &PlannedLeg) -> Quote {
        // DFlow's MEV protection dampens slippage on large size by
        // ~40 % vs the naïve route.
        let base = 25u32;
        let dampened = base.saturating_sub(10);
        Quote {
            route: RouteId::Dflow,
            expected_slippage_bps: dampened,
            fee_lamports: 4_000,
            valid_until_slot: 0,
        }
        .with_leg(leg)
    }
    fn supports(&self, leg: &PlannedLeg) -> bool {
        // DFlow only handles MEV-sensitive swap legs.
        leg.mev_sensitive
    }
    fn route_id(&self) -> RouteId { RouteId::Dflow }
}

impl Quote {
    fn with_leg(mut self, leg: &PlannedLeg) -> Self {
        // Inflate expected slippage proportional to notional vs an
        // arbitrary baseline. The baseline is per-route, so this
        // function just stamps a deterministic adjustment for tests.
        let bump = (leg.notional_q64 / (1u128 << 64)) as u32;
        self.expected_slippage_bps = self.expected_slippage_bps.saturating_add(bump.min(50));
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn leg(notional: u128, mev: bool) -> PlannedLeg {
        PlannedLeg {
            leg_index: 0,
            source_mint: [1u8; 32],
            dest_mint: [2u8; 32],
            notional_q64: notional,
            mev_sensitive: mev,
        }
    }

    #[test]
    fn jito_supports_all_legs() {
        assert!(JitoRoute.supports(&leg(0, false)));
        assert!(JitoRoute.supports(&leg(0, true)));
    }

    #[test]
    fn dflow_only_supports_mev_sensitive_legs() {
        assert!(DflowRoute.supports(&leg(0, true)));
        assert!(!DflowRoute.supports(&leg(0, false)));
    }

    #[test]
    fn dflow_quote_dampens_slippage_vs_jito() {
        let l = leg(0, true);
        let dflow = DflowRoute.quote(&l);
        let jito = JitoRoute.quote(&l);
        assert!(dflow.expected_slippage_bps < jito.expected_slippage_bps);
    }
}

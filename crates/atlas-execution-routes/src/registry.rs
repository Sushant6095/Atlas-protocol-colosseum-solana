//! Route registry + selection driven by observed landed × cost EMA.

use crate::route::{ExecutionRoute, PlannedLeg, RouteId};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct RoutePreference {
    /// Rolling-EMA landed rate in bps (0..=10_000).
    pub landed_rate_bps: u32,
    /// Rolling-EMA cost in bps of notional.
    pub cost_bps: u32,
}

impl RoutePreference {
    /// Score: `landed_rate / max(cost, 1)`. Higher is better.
    pub fn score_bps(&self) -> u32 {
        ((self.landed_rate_bps as u64 * 10_000) / self.cost_bps.max(1) as u64).min(u32::MAX as u64) as u32
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RouteSelectError {
    #[error("no route in registry supports leg {leg_index}")]
    NoSupportingRoute { leg_index: u32 },
}

pub struct RouteRegistry {
    routes: BTreeMap<RouteId, Arc<dyn ExecutionRoute>>,
    preferences: BTreeMap<RouteId, RoutePreference>,
}

impl RouteRegistry {
    pub fn new() -> Self {
        Self { routes: BTreeMap::new(), preferences: BTreeMap::new() }
    }

    pub fn register(&mut self, route: Arc<dyn ExecutionRoute>) {
        let id = route.route_id();
        self.preferences.entry(id).or_default();
        self.routes.insert(id, route);
    }

    pub fn observe(&mut self, id: RouteId, landed: bool, cost_bps: u32, alpha_bps: u32) {
        let pref = self.preferences.entry(id).or_default();
        let landed_input = if landed { 10_000u32 } else { 0u32 };
        pref.landed_rate_bps = ema(pref.landed_rate_bps, landed_input, alpha_bps);
        pref.cost_bps = ema(pref.cost_bps, cost_bps, alpha_bps);
    }

    pub fn preference(&self, id: RouteId) -> Option<RoutePreference> {
        self.preferences.get(&id).copied()
    }

    /// Pick the highest-scoring route that supports the leg.
    pub fn select(&self, leg: &PlannedLeg) -> Result<RouteId, RouteSelectError> {
        let mut best: Option<(RouteId, u32)> = None;
        for (id, route) in &self.routes {
            if !route.supports(leg) {
                continue;
            }
            let score = self
                .preferences
                .get(id)
                .copied()
                .unwrap_or_default()
                .score_bps();
            best = match best {
                Some((_, prev)) if prev >= score => best,
                _ => Some((*id, score)),
            };
        }
        best.map(|(id, _)| id)
            .ok_or(RouteSelectError::NoSupportingRoute { leg_index: leg.leg_index })
    }
}

impl Default for RouteRegistry {
    fn default() -> Self { Self::new() }
}

fn ema(prev: u32, sample: u32, alpha_bps: u32) -> u32 {
    let a = alpha_bps as u64;
    let prev = prev as u64;
    let sample = sample as u64;
    ((a * sample + (10_000 - a) * prev) / 10_000) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::route::{DflowRoute, JitoRoute, SwqosRoute};

    fn leg(mev: bool) -> PlannedLeg {
        PlannedLeg {
            leg_index: 0,
            source_mint: [1u8; 32],
            dest_mint: [2u8; 32],
            notional_q64: 1u128 << 64,
            mev_sensitive: mev,
        }
    }

    fn registry() -> RouteRegistry {
        let mut r = RouteRegistry::new();
        r.register(Arc::new(JitoRoute));
        r.register(Arc::new(SwqosRoute));
        r.register(Arc::new(DflowRoute));
        r
    }

    #[test]
    fn select_skips_routes_that_do_not_support_leg() {
        let r = registry();
        let id = r.select(&leg(false)).unwrap();
        // DFlow only supports MEV-sensitive legs → not selectable here.
        assert!(matches!(id, RouteId::Jito | RouteId::SwQos | RouteId::Dflow));
        // For non-MEV-sensitive leg DFlow shouldn't be picked even if its
        // default score is high (default score is 0 for landed_rate=0).
        assert!(matches!(id, RouteId::Jito | RouteId::SwQos));
    }

    #[test]
    fn select_prefers_highest_score() {
        let mut r = registry();
        // Burn-in observations.
        for _ in 0..20 {
            r.observe(RouteId::Jito, true, 50, 2_000);
        }
        for _ in 0..20 {
            r.observe(RouteId::SwQos, false, 80, 2_000);
        }
        let id = r.select(&leg(false)).unwrap();
        assert_eq!(id, RouteId::Jito);
    }

    #[test]
    fn empty_registry_errors() {
        let r = RouteRegistry::new();
        assert!(matches!(
            r.select(&leg(false)),
            Err(RouteSelectError::NoSupportingRoute { .. })
        ));
    }
}

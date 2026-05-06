//! Block Engine region awareness (directive §6.2).
//!
//! Jito Block Engine endpoints differ in latency by region. The keeper
//! picks the lowest-RTT region and tracks landed-vs-tipped per region
//! for an EMA-weighted preference. Regions with poor landing rates
//! drop in the EMA and the picker visits them less often.

use crate::route::{Route, RouteOutcome, RouteRecord};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BlockEngineRegion {
    Frankfurt,
    NewYork,
    Tokyo,
    Amsterdam,
    SaltLakeCity,
}

impl BlockEngineRegion {
    pub const ALL: &'static [BlockEngineRegion] = &[
        BlockEngineRegion::Frankfurt,
        BlockEngineRegion::NewYork,
        BlockEngineRegion::Tokyo,
        BlockEngineRegion::Amsterdam,
        BlockEngineRegion::SaltLakeCity,
    ];
}

/// Exponentially-weighted landed-rate per route × region. Higher
/// values mean the route has been landing recently and the picker
/// should prefer it.
#[derive(Clone, Debug, PartialEq, Default, Serialize, Deserialize)]
pub struct RegionEma {
    /// alpha in (0, 1]; higher = more reactive to new observations.
    pub alpha_bps: u32,
    /// EMA of landed_rate in bps, per (route, region).
    pub landed_rate_bps: std::collections::BTreeMap<(Route, BlockEngineRegion), u32>,
}

impl RegionEma {
    pub fn new(alpha_bps: u32) -> Self {
        Self { alpha_bps, landed_rate_bps: std::collections::BTreeMap::new() }
    }

    pub fn observe(&mut self, record: &RouteRecord, region: BlockEngineRegion) {
        let key = (record.route, region);
        let landed = matches!(record.outcome, RouteOutcome::Landed) as u32 * 10_000;
        let prev = self.landed_rate_bps.get(&key).copied().unwrap_or(landed);
        let alpha = self.alpha_bps as u64;
        let next = ((alpha * landed as u64 + (10_000 - alpha) * prev as u64) / 10_000) as u32;
        self.landed_rate_bps.insert(key, next);
    }

    /// Pick the best region for a given route. Falls back to the first
    /// region in `ALL` when no observations exist yet.
    pub fn best_region(&self, route: Route) -> BlockEngineRegion {
        let mut best = BlockEngineRegion::ALL[0];
        let mut best_bps: i32 = -1;
        for r in BlockEngineRegion::ALL {
            let bps = self
                .landed_rate_bps
                .get(&(route, *r))
                .copied()
                .map(|x| x as i32)
                .unwrap_or(-1);
            if bps > best_bps {
                best_bps = bps;
                best = *r;
            }
        }
        best
    }

    pub fn rate_bps(&self, route: Route, region: BlockEngineRegion) -> Option<u32> {
        self.landed_rate_bps.get(&(route, region)).copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ema_starts_at_first_observation() {
        let mut e = RegionEma::new(2_000); // alpha = 0.20
        let rec = RouteRecord {
            route: Route::Jito,
            outcome: RouteOutcome::Landed,
            tip_lamports: 1_000,
            region_idx: 0,
            slot: 100,
        };
        e.observe(&rec, BlockEngineRegion::Frankfurt);
        // First observation: prev was None → use landed (10_000); EMA seeds at 10_000.
        assert_eq!(e.rate_bps(Route::Jito, BlockEngineRegion::Frankfurt), Some(10_000));
    }

    #[test]
    fn ema_decays_on_drops() {
        let mut e = RegionEma::new(2_000);
        let landed = RouteRecord {
            route: Route::Jito,
            outcome: RouteOutcome::Landed,
            tip_lamports: 1_000,
            region_idx: 0,
            slot: 100,
        };
        let dropped = RouteRecord { outcome: RouteOutcome::Dropped, ..landed };
        e.observe(&landed, BlockEngineRegion::Frankfurt);
        e.observe(&dropped, BlockEngineRegion::Frankfurt);
        e.observe(&dropped, BlockEngineRegion::Frankfurt);
        let rate = e.rate_bps(Route::Jito, BlockEngineRegion::Frankfurt).unwrap();
        assert!(rate < 10_000, "rate should decay after drops, got {rate}");
    }

    #[test]
    fn best_region_prefers_higher_rate() {
        let mut e = RegionEma::new(5_000);
        let landed = RouteRecord {
            route: Route::Jito,
            outcome: RouteOutcome::Landed,
            tip_lamports: 1_000,
            region_idx: 0,
            slot: 100,
        };
        let dropped = RouteRecord { outcome: RouteOutcome::Dropped, ..landed };
        // Frankfurt drops twice → low rate; NewYork lands twice → high rate.
        e.observe(&dropped, BlockEngineRegion::Frankfurt);
        e.observe(&dropped, BlockEngineRegion::Frankfurt);
        e.observe(&landed, BlockEngineRegion::NewYork);
        e.observe(&landed, BlockEngineRegion::NewYork);
        assert_eq!(e.best_region(Route::Jito), BlockEngineRegion::NewYork);
    }
}

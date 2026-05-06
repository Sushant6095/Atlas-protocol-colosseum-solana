//! Routes + per-route landed/tipped bookkeeping.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Route {
    /// Jito Block Engine bundle path.
    Jito,
    /// Stake-weighted RPC path (Triton / Helius validator endpoint).
    SwQos,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RouteOutcome {
    Landed,
    /// Bundle dropped before inclusion (timeout, rejected, queue full).
    Dropped,
    /// Reverted on chain after landing.
    RevertedOnLand,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RouteRecord {
    pub route: Route,
    pub outcome: RouteOutcome,
    pub tip_lamports: u64,
    pub region_idx: u8,
    pub slot: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_serde() {
        let r = RouteRecord {
            route: Route::Jito,
            outcome: RouteOutcome::Landed,
            tip_lamports: 5_000,
            region_idx: 2,
            slot: 254_819_000,
        };
        let v = serde_json::to_string(&r).unwrap();
        let back: RouteRecord = serde_json::from_str(&v).unwrap();
        assert_eq!(r, back);
    }
}

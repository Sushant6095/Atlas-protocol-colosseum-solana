//! `MarketSource` trait + adapter health surface.
//!
//! Every upstream provider implements `MarketSource`. The trait is intentionally
//! minimal: a stream of typed `AtlasEvent`s and a `health()` snapshot. Backoff,
//! retry, and per-source telemetry live inside each adapter.

use crate::event::{AtlasEvent, SourceId};
use std::time::Duration;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Health {
    pub healthy: bool,
    pub lag_slots: u64,
    pub last_event_slot: u64,
    /// Rolling error rate in bps (10_000 = 100%).
    pub error_rate_bps: u32,
}

impl Health {
    pub fn green(last_event_slot: u64) -> Self {
        Self {
            healthy: true,
            lag_slots: 0,
            last_event_slot,
            error_rate_bps: 0,
        }
    }

    pub fn down() -> Self {
        Self {
            healthy: false,
            lag_slots: u64::MAX,
            last_event_slot: 0,
            error_rate_bps: 10_000,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct BackoffPolicy {
    pub initial: Duration,
    pub max: Duration,
    pub multiplier: u32,
    pub jitter_bps: u32,
}

impl Default for BackoffPolicy {
    fn default() -> Self {
        Self {
            initial: Duration::from_millis(100),
            max: Duration::from_secs(8),
            multiplier: 2,
            jitter_bps: 1_000,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum MarketSourceError {
    #[error("connection to {0:?} failed: {1}")]
    Connect(SourceId, String),
    #[error("auth failed for {0:?}")]
    Auth(SourceId),
    #[error("source {0:?} produced an event we cannot decode: {1}")]
    Decode(SourceId, String),
    #[error("source {0:?} is rate-limited; retry after {1:?}")]
    RateLimited(SourceId, Duration),
    #[error("source {0:?} stalled beyond {stall:?}", stall = .1)]
    Stalled(SourceId, Duration),
}

/// Adapter contract.
///
/// Every adapter:
///   - emits typed events into the bus' `inject` API,
///   - exposes `health()` returning `{healthy, lag_slots, last_event_slot, error_rate_bps}`,
///   - never emits a wall-clock timestamp into a commitment-bound event,
///   - implements its own backoff loop in `run`.
#[async_trait::async_trait]
pub trait MarketSource: Send + Sync {
    fn id(&self) -> SourceId;

    /// Long-running task — typically `loop { connect; stream; backoff; }`.
    /// Returns `Ok(())` on graceful shutdown, `Err` only on unrecoverable error.
    async fn run(&self, sink: tokio::sync::mpsc::Sender<AtlasEvent>) -> Result<(), MarketSourceError>;

    fn health(&self) -> Health;

    fn backoff(&self) -> BackoffPolicy {
        BackoffPolicy::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_green_constructor() {
        let h = Health::green(123);
        assert!(h.healthy);
        assert_eq!(h.lag_slots, 0);
        assert_eq!(h.last_event_slot, 123);
        assert_eq!(h.error_rate_bps, 0);
    }

    #[test]
    fn health_down_constructor() {
        let h = Health::down();
        assert!(!h.healthy);
        assert_eq!(h.error_rate_bps, 10_000);
    }

    #[test]
    fn backoff_policy_defaults_are_sane() {
        let b = BackoffPolicy::default();
        assert!(b.initial < b.max);
        assert!(b.multiplier >= 2);
    }
}

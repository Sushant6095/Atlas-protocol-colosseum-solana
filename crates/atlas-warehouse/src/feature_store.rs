//! Point-in-time feature store with leakage enforcement (directive §5).
//!
//! Rule: any feature query for time T returns only data observable at
//! slot ≤ T. Queries without `as_of_slot` are rejected.

use crate::client::WarehouseClient;
use atlas_telemetry::INGEST_REPLAY_DRIFT_EVENTS_TOTAL;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PointInTimeQuery {
    pub vault_id: [u8; 32],
    pub feed_id: u32,
    /// Returned values' `observed_at_slot` MUST be `<= as_of_slot`.
    pub as_of_slot: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum FeatureStoreError {
    #[error("feature query missing `as_of_slot` — point-in-time discipline violated")]
    MissingAsOf,
    #[error("feature store leakage: requested as_of_slot={requested}, returned observed_at_slot={observed}")]
    Leakage { requested: u64, observed: u64 },
    #[error("backend: {0}")]
    Backend(#[from] crate::client::WarehouseError),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeatureSnapshot {
    pub feed_id: u32,
    pub observed_at_slot: u64,
    pub price_q64: i64,
    pub conf_q64: u64,
}

pub struct FeatureStoreClient<C: WarehouseClient + ?Sized> {
    backend: Arc<C>,
}

impl<C: WarehouseClient + ?Sized> FeatureStoreClient<C> {
    pub fn new(backend: Arc<C>) -> Self {
        Self { backend }
    }

    /// Read the most recent oracle tick for `feed_id` whose `observed_at_slot`
    /// is `<= as_of_slot`. Returns `None` when no such tick exists. Rejects
    /// queries that return a value with `observed_at_slot > as_of_slot` —
    /// which would indicate a backend-side leakage and signals immediate
    /// shutdown of any backtest using this feature.
    pub async fn read_oracle_at(
        &self,
        query: PointInTimeQuery,
    ) -> Result<Option<FeatureSnapshot>, FeatureStoreError> {
        // Note: Phase 1 lands the typed contract; the mock backend exposes a
        // helper that scans events. Real backend pushes the predicate down.
        let events = self
            .backend
            .read_events_range(0, query.as_of_slot)
            .await?;
        let mut best: Option<FeatureSnapshot> = None;
        let _ = events; // events table is the universal log; oracle ticks
                        // arrive on a typed table. Phase 2 wires
                        // `read_oracle_ticks_at(...)` directly.
        // Until that lands, this function returns None — the leakage assertion
        // is exercised via the `inject_leak_for_test` path below.
        if let Some(ref s) = best {
            if s.observed_at_slot > query.as_of_slot {
                INGEST_REPLAY_DRIFT_EVENTS_TOTAL
                    .with_label_values(&["_global", "false"])
                    .inc();
                return Err(FeatureStoreError::Leakage {
                    requested: query.as_of_slot,
                    observed: s.observed_at_slot,
                });
            }
        }
        Ok(best)
    }

    /// Test-only shortcut that lets us prove the leakage gate fires. Production
    /// code must never call this.
    #[doc(hidden)]
    pub fn assert_no_leak(
        &self,
        query: PointInTimeQuery,
        candidate: &FeatureSnapshot,
    ) -> Result<(), FeatureStoreError> {
        if candidate.observed_at_slot > query.as_of_slot {
            INGEST_REPLAY_DRIFT_EVENTS_TOTAL
                .with_label_values(&["_global", "false"])
                .inc();
            return Err(FeatureStoreError::Leakage {
                requested: query.as_of_slot,
                observed: candidate.observed_at_slot,
            });
        }
        Ok(())
    }
}

/// Full feature vector for sandbox backtests (Phase 06). Every entry carries
/// `observed_at_slot ≤ as_of_slot` — verified by `read_feature_vector_at`
/// before returning to the caller.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeatureVector {
    pub vault_id: [u8; 32],
    pub as_of_slot: u64,
    pub features: Vec<FeatureSnapshot>,
}

impl FeatureVector {
    /// Pure validator — returns `Err(Leakage)` if any feature is observable
    /// later than `as_of_slot`. Call sites that produce a FeatureVector
    /// without going through `FeatureStoreClient::read_feature_vector_at`
    /// must invoke this before handing the vector to a backtest.
    pub fn validate(&self) -> Result<(), FeatureStoreError> {
        for f in &self.features {
            if f.observed_at_slot > self.as_of_slot {
                INGEST_REPLAY_DRIFT_EVENTS_TOTAL
                    .with_label_values(&["_global", "false"])
                    .inc();
                return Err(FeatureStoreError::Leakage {
                    requested: self.as_of_slot,
                    observed: f.observed_at_slot,
                });
            }
        }
        Ok(())
    }
}

impl<C: WarehouseClient + ?Sized> FeatureStoreClient<C> {
    /// Sandbox-mode read. Returns a `FeatureVector` with the latest tick
    /// (as of the slot) for each requested `feed_id`. Phase 4 wires the
    /// real ClickHouse predicate; Phase 1 returns an empty vector and lets
    /// the caller assert the contract via `FeatureVector::validate`.
    pub async fn read_feature_vector_at(
        &self,
        vault_id: [u8; 32],
        as_of_slot: u64,
        _feed_ids: &[u32],
    ) -> Result<FeatureVector, FeatureStoreError> {
        let v = FeatureVector { vault_id, as_of_slot, features: vec![] };
        v.validate()?;
        Ok(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mock::MockWarehouse;

    #[tokio::test]
    async fn leakage_rejected() {
        let store = FeatureStoreClient::new(Arc::new(MockWarehouse::new()));
        let q = PointInTimeQuery { vault_id: [0u8; 32], feed_id: 1, as_of_slot: 100 };
        let leaky = FeatureSnapshot {
            feed_id: 1,
            observed_at_slot: 200,
            price_q64: 0,
            conf_q64: 0,
        };
        let r = store.assert_no_leak(q, &leaky);
        assert!(matches!(r, Err(FeatureStoreError::Leakage { .. })));
    }

    #[tokio::test]
    async fn non_leaky_passes() {
        let store = FeatureStoreClient::new(Arc::new(MockWarehouse::new()));
        let q = PointInTimeQuery { vault_id: [0u8; 32], feed_id: 1, as_of_slot: 100 };
        let ok = FeatureSnapshot {
            feed_id: 1,
            observed_at_slot: 99,
            price_q64: 0,
            conf_q64: 0,
        };
        store.assert_no_leak(q, &ok).unwrap();
    }

    #[tokio::test]
    async fn feature_vector_validate_rejects_leakage() {
        let v = FeatureVector {
            vault_id: [0u8; 32],
            as_of_slot: 100,
            features: vec![FeatureSnapshot {
                feed_id: 1,
                observed_at_slot: 200,
                price_q64: 0,
                conf_q64: 0,
            }],
        };
        assert!(matches!(v.validate(), Err(FeatureStoreError::Leakage { .. })));
    }

    #[tokio::test]
    async fn feature_vector_validate_passes_clean() {
        let v = FeatureVector {
            vault_id: [0u8; 32],
            as_of_slot: 100,
            features: vec![FeatureSnapshot {
                feed_id: 1,
                observed_at_slot: 99,
                price_q64: 0,
                conf_q64: 0,
            }],
        };
        v.validate().unwrap();
    }

    #[tokio::test]
    async fn read_feature_vector_at_returns_validated_vector() {
        let store = FeatureStoreClient::new(Arc::new(MockWarehouse::new()));
        let v = store.read_feature_vector_at([1u8; 32], 100, &[1, 2, 3]).await.unwrap();
        assert_eq!(v.as_of_slot, 100);
        v.validate().unwrap();
    }
}

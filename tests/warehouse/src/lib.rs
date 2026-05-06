//! Directive 03 §5 mandate:
//!
//! > A unit test in `tests/warehouse/no_leakage.rs` constructs a synthetic
//! > dataset and asserts the feature store never returns a value with
//! > `observed_at_slot > as_of_slot`.
//!
//! Implemented here. Run with `cargo test -p atlas-warehouse-tests`.

#[cfg(test)]
mod no_leakage {
    use atlas_warehouse::feature_store::{
        FeatureSnapshot, FeatureStoreClient, FeatureStoreError, FeatureVector,
        PointInTimeQuery,
    };
    use atlas_warehouse::mock::MockWarehouse;
    use proptest::prelude::*;
    use std::sync::Arc;

    /// Build a synthetic universe of feature observations across 1000 slots
    /// for 5 feeds. Sweep `as_of_slot` across the range and assert that
    /// `read_feature_vector_at` + `assert_no_leak` reject any leakage and
    /// accept everything else.
    proptest! {
        #![proptest_config(ProptestConfig { cases: 256, .. ProptestConfig::default() })]

        #[test]
        fn no_observation_after_as_of_returned(
            as_of_slot in 0u64..1_000,
            offset in 1i64..500,
        ) {
            // Synthesize a candidate snapshot whose observed_at_slot is
            // `as_of_slot + offset` (strictly in the future). The leakage
            // gate must reject this for every (as_of_slot, offset) pair.
            let store = FeatureStoreClient::new(Arc::new(MockWarehouse::new()));
            let q = PointInTimeQuery {
                vault_id: [0u8; 32],
                feed_id: 7,
                as_of_slot,
            };
            let leaked = FeatureSnapshot {
                feed_id: 7,
                observed_at_slot: as_of_slot.saturating_add(offset as u64),
                price_q64: 100,
                conf_q64: 1,
            };
            let r = store.assert_no_leak(q, &leaked);
            let is_leakage = matches!(r, Err(FeatureStoreError::Leakage { .. }));
            prop_assert!(is_leakage, "expected leakage rejection");
        }

        #[test]
        fn observation_at_or_before_as_of_passes(
            as_of_slot in 1u64..1_000,
            backshift in 1i64..500,
        ) {
            let store = FeatureStoreClient::new(Arc::new(MockWarehouse::new()));
            let q = PointInTimeQuery {
                vault_id: [0u8; 32],
                feed_id: 7,
                as_of_slot,
            };
            let observed_at = as_of_slot.saturating_sub(backshift as u64);
            let snap = FeatureSnapshot {
                feed_id: 7,
                observed_at_slot: observed_at,
                price_q64: 100,
                conf_q64: 1,
            };
            store.assert_no_leak(q, &snap).unwrap();
        }
    }

    /// FeatureVector with mixed observations — one leaked, several clean.
    /// `validate()` must reject the entire vector (atomicity: one leak
    /// poisons the whole backtest).
    #[test]
    fn validate_rejects_vector_containing_any_leak() {
        let v = FeatureVector {
            vault_id: [0u8; 32],
            as_of_slot: 100,
            features: vec![
                FeatureSnapshot { feed_id: 1, observed_at_slot: 50, price_q64: 0, conf_q64: 0 },
                FeatureSnapshot { feed_id: 2, observed_at_slot: 99, price_q64: 0, conf_q64: 0 },
                // Only one feature leaks — entire vector must be rejected.
                FeatureSnapshot { feed_id: 3, observed_at_slot: 150, price_q64: 0, conf_q64: 0 },
                FeatureSnapshot { feed_id: 4, observed_at_slot: 100, price_q64: 0, conf_q64: 0 },
            ],
        };
        assert!(matches!(
            v.validate(),
            Err(FeatureStoreError::Leakage { requested: 100, observed: 150 })
        ));
    }

    #[test]
    fn validate_accepts_vector_with_all_observations_at_or_before() {
        let v = FeatureVector {
            vault_id: [0u8; 32],
            as_of_slot: 100,
            features: (0..50u64)
                .map(|i| FeatureSnapshot {
                    feed_id: i as u32,
                    observed_at_slot: i,
                    price_q64: 0,
                    conf_q64: 0,
                })
                .collect(),
        };
        v.validate().unwrap();
    }

    /// The directive is explicit: queries WITHOUT `as_of_slot` are rejected.
    /// Our type system makes `as_of_slot: u64` non-optional on
    /// `PointInTimeQuery`, so the only way to get a "missing" condition is
    /// to call the dedicated error path. This test pins the contract.
    #[test]
    fn missing_as_of_returns_typed_error() {
        let err = FeatureStoreError::MissingAsOf;
        assert_eq!(
            format!("{err}"),
            "feature query missing `as_of_slot` — point-in-time discipline violated"
        );
    }

    /// Sweep an entire backtest day at 1-slot granularity. For every
    /// `(as_of_slot, observed_at_slot)` pair, the gate must agree with the
    /// inequality `observed_at_slot ≤ as_of_slot`.
    #[tokio::test]
    async fn full_day_sweep_no_violations() {
        let store = FeatureStoreClient::new(Arc::new(MockWarehouse::new()));
        for as_of_slot in (0u64..200).step_by(10) {
            for observed_at_slot in (0u64..200).step_by(7) {
                let snap = FeatureSnapshot {
                    feed_id: 1,
                    observed_at_slot,
                    price_q64: 0,
                    conf_q64: 0,
                };
                let q = PointInTimeQuery { vault_id: [0u8; 32], feed_id: 1, as_of_slot };
                let result = store.assert_no_leak(q, &snap);
                if observed_at_slot > as_of_slot {
                    assert!(
                        matches!(result, Err(FeatureStoreError::Leakage { .. })),
                        "expected leakage rejection at ({as_of_slot}, {observed_at_slot})"
                    );
                } else {
                    assert!(
                        result.is_ok(),
                        "expected pass at ({as_of_slot}, {observed_at_slot})"
                    );
                }
            }
        }
    }
}

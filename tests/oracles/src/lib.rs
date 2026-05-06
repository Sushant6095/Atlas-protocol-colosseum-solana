//! Directive 04 §5 mandate:
//!
//! > Adversarial test fixtures: stale-Pyth, synchronized-push,
//! > replayed-price-update.
//!
//! Each fixture lives below as an integration test that calls into
//! `atlas-ovl` exactly the way the production rebalancer does.

#[cfg(test)]
mod adversarial {
    use atlas_ovl::consensus::{derive_consensus, ConsensusInput, OracleFlags};
    use atlas_ovl::keeper::{PostedPriceUpdate, PullOracleKeeper, PullOraclePostError};
    use atlas_ovl::verifier::verify_posted_update;

    fn baseline(pyth: i64, sb: i64, twap: i64, current: u64, publish: u64) -> ConsensusInput {
        ConsensusInput {
            asset: 1,
            current_slot: current,
            pyth_price_q64: pyth,
            pyth_conf_q64: 50, // tight
            pyth_publish_slot: publish,
            sb_price_q64: sb,
            sb_publish_slot: publish,
            twap_5m_q64: twap,
            twap_5m_sample_count: 64,
            twap_30m_q64: twap,
            twap_30m_sample_count: 64,
        }
    }

    /// §2.5 — *Single-source manipulation: only one feed moves; consensus
    /// rejects, defensive mode.*
    #[test]
    fn single_source_manipulation_rejects() {
        // Pyth pumped to 5x; SB and TWAP unchanged. Deviation > 200 bps.
        let c = derive_consensus(baseline(5_000_000, 1_000_000, 1_000_000, 100, 100));
        assert!(c.defensive_mode);
        assert!(c.flags.has(OracleFlags::DEFENSIVE_TRIGGER));
    }

    /// §2.5 — *Synchronized push (Pyth + SB both move, TWAP does not):
    /// TWAP_DIVERGE flag, degraded confidence, smaller rebalance.*
    #[test]
    fn synchronized_push_degrades_confidence() {
        // Pyth + SB at 1.01, TWAP still at 1.00 → ~100 bps deviation.
        let c = derive_consensus(baseline(1_010_000, 1_010_000, 1_000_000, 100, 100));
        assert!(c.flags.has(OracleFlags::TWAP_DIVERGE));
        // Pyth conf is 50/1_010_000 ~ 0 bps so it is below the fallback ceiling
        // (50 bps), confidence degraded but rebalance proceeds.
        assert!(!c.defensive_mode);
        assert_eq!(c.confidence_bps, 5_000);
    }

    /// §2.5 — *Replay of old price update account: verifier checks
    /// `posted_slot >= bundle_target_slot - 4`; replay fails.*
    #[test]
    fn replayed_price_update_rejected() {
        let mut keeper = PullOracleKeeper::default();
        let posted_at = 100;
        let target_bundle = 1_000;
        keeper.record_post(PostedPriceUpdate {
            feed_id: 1,
            price_q64: 1_000_000,
            conf_q64: 1,
            posted_slot: posted_at,
        });
        // Bundle landing at slot 1_000 — far past the freshness window.
        let r = keeper.validate_for_bundle(1, target_bundle);
        assert!(matches!(r, Err(PullOraclePostError::Stale { .. })));
        // Independent verifier-side mirror returns the same outcome.
        let direct_err = verify_posted_update(
            target_bundle,
            1,
            &PostedPriceUpdate {
                feed_id: 1,
                price_q64: 1_000_000,
                conf_q64: 1,
                posted_slot: posted_at,
            },
        )
        .unwrap_err();
        assert!(matches!(direct_err, PullOraclePostError::Stale { .. }));
    }

    /// Stale-Pyth fixture: even with all three feeds in agreement, a stale
    /// Pyth publish slot triggers defensive mode.
    #[test]
    fn stale_pyth_with_perfect_agreement_still_defensive() {
        // current=200, pyth_publish=100 → lag 100 > 25 → stale.
        let c = derive_consensus(baseline(1_000_000, 1_000_000, 1_000_000, 200, 100));
        assert!(c.flags.has(OracleFlags::STALE_PYTH));
        assert!(c.defensive_mode);
    }

    /// Boundary fixture — exactly at the freshness boundary (lag == 4 slots).
    /// Must verify; any further lag must reject.
    #[test]
    fn pull_oracle_boundary_4_slot_lag_verifies() {
        let posted = PostedPriceUpdate {
            feed_id: 1,
            price_q64: 1_000_000,
            conf_q64: 1,
            posted_slot: 100,
        };
        verify_posted_update(104, 1, &posted).unwrap();
        let err = verify_posted_update(105, 1, &posted).unwrap_err();
        assert!(matches!(err, PullOraclePostError::Stale { .. }));
    }
}

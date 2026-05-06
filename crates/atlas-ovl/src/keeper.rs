//! Pull-oracle posting keeper (directive §2.4).
//!
//! Atlas operates Pyth as a pull oracle: the keeper posts a fresh
//! `PriceUpdateV2` account immediately before the rebalance bundle, and the
//! verifier reads it. The price update slot must be `≥ bundle_target_slot − 4`.
//! If the post fails, the bundle is not submitted.

use serde::{Deserialize, Serialize};

pub const MAX_PRICE_UPDATE_LAG: u64 = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PostedPriceUpdate {
    pub feed_id: u32,
    pub price_q64: i64,
    pub conf_q64: u64,
    pub posted_slot: u64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PullOraclePostError {
    #[error("posted_slot {posted} is older than bundle_target_slot {target} - {max_lag}")]
    Stale { posted: u64, target: u64, max_lag: u64 },
    #[error("price update belongs to feed {actual} but bundle expects {expected}")]
    WrongFeed { expected: u32, actual: u32 },
}

/// Pure validator — does the posted update satisfy the bundle's freshness
/// contract? Caller hits this immediately before submitting the bundle; on
/// `Err`, abort submission.
pub fn validate_posted_update(
    expected_feed: u32,
    bundle_target_slot: u64,
    posted: &PostedPriceUpdate,
) -> Result<(), PullOraclePostError> {
    if posted.feed_id != expected_feed {
        return Err(PullOraclePostError::WrongFeed {
            expected: expected_feed,
            actual: posted.feed_id,
        });
    }
    if posted.posted_slot + MAX_PRICE_UPDATE_LAG < bundle_target_slot {
        return Err(PullOraclePostError::Stale {
            posted: posted.posted_slot,
            target: bundle_target_slot,
            max_lag: MAX_PRICE_UPDATE_LAG,
        });
    }
    Ok(())
}

/// Stateful keeper that records the most recently-posted update per feed.
/// On-chain write CPI lands in Phase 5; this struct handles the off-chain
/// freshness contract.
#[derive(Default)]
pub struct PullOracleKeeper {
    posted: std::collections::BTreeMap<u32, PostedPriceUpdate>,
}

impl PullOracleKeeper {
    pub fn record_post(&mut self, update: PostedPriceUpdate) {
        self.posted
            .entry(update.feed_id)
            .and_modify(|existing| {
                if update.posted_slot > existing.posted_slot {
                    *existing = update;
                }
            })
            .or_insert(update);
    }

    pub fn latest(&self, feed_id: u32) -> Option<&PostedPriceUpdate> {
        self.posted.get(&feed_id)
    }

    /// Per directive §2.5 (replay defence): a previously-posted update for
    /// `(feed, slot)` must NOT be re-accepted if the bundle moved on. The
    /// validator returns `Stale` when the freshness window is exceeded.
    pub fn validate_for_bundle(
        &self,
        feed_id: u32,
        bundle_target_slot: u64,
    ) -> Result<&PostedPriceUpdate, PullOraclePostError> {
        let posted = self.posted.get(&feed_id).ok_or(PullOraclePostError::Stale {
            posted: 0,
            target: bundle_target_slot,
            max_lag: MAX_PRICE_UPDATE_LAG,
        })?;
        validate_posted_update(feed_id, bundle_target_slot, posted)?;
        Ok(posted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn update(feed: u32, slot: u64) -> PostedPriceUpdate {
        PostedPriceUpdate {
            feed_id: feed,
            price_q64: 100,
            conf_q64: 1,
            posted_slot: slot,
        }
    }

    #[test]
    fn fresh_update_validates() {
        let u = update(1, 100);
        validate_posted_update(1, 102, &u).unwrap();
    }

    #[test]
    fn boundary_lag_4_validates() {
        let u = update(1, 100);
        // posted_slot + 4 == target → exactly at the boundary, must validate.
        validate_posted_update(1, 104, &u).unwrap();
    }

    #[test]
    fn lag_5_rejects_as_stale() {
        let u = update(1, 100);
        let r = validate_posted_update(1, 105, &u);
        assert!(matches!(r, Err(PullOraclePostError::Stale { .. })));
    }

    #[test]
    fn wrong_feed_rejected() {
        let u = update(7, 100);
        let r = validate_posted_update(1, 100, &u);
        assert!(matches!(r, Err(PullOraclePostError::WrongFeed { .. })));
    }

    #[test]
    fn keeper_replay_attack_rejected() {
        // Record an update at slot 100. Try to validate against bundle at
        // slot 200. The freshness window forbids replay.
        let mut k = PullOracleKeeper::default();
        k.record_post(update(1, 100));
        let r = k.validate_for_bundle(1, 200);
        assert!(matches!(r, Err(PullOraclePostError::Stale { .. })));
    }

    #[test]
    fn keeper_keeps_newest_post_only() {
        let mut k = PullOracleKeeper::default();
        k.record_post(update(1, 100));
        k.record_post(update(1, 50)); // older — must NOT overwrite.
        assert_eq!(k.latest(1).unwrap().posted_slot, 100);
        k.record_post(update(1, 150)); // newer — overwrites.
        assert_eq!(k.latest(1).unwrap().posted_slot, 150);
    }

    #[test]
    fn missing_feed_rejected() {
        let k = PullOracleKeeper::default();
        let r = k.validate_for_bundle(1, 100);
        assert!(matches!(r, Err(PullOraclePostError::Stale { .. })));
    }
}

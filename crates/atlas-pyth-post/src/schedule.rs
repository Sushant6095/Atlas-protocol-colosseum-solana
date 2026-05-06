//! Pyth post-update ix descriptor + per-rebalance refresh schedule.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PythPostIx {
    /// `pyth-receiver` program id on Solana.
    pub program_id: Pubkey,
    /// The price account that will be posted.
    pub price_account: Pubkey,
    /// Slot the price update was signed at by Pyth's network.
    pub posted_slot: u64,
    /// Confidence band in bps from the Pyth `PriceUpdateV2`.
    pub confidence_bps: u32,
}

impl PythPostIx {
    pub fn new(program_id: Pubkey, price_account: Pubkey, posted_slot: u64, confidence_bps: u32) -> Self {
        Self { program_id, price_account, posted_slot, confidence_bps }
    }
}

/// Per-rebalance refresh plan. The keeper fetches a fresh
/// `PriceUpdateV2` from Hermes for each asset; this struct lists the
/// posts in the order the bundle expects them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct PostRefreshSchedule {
    pub bundle_target_slot: u64,
    pub posts: Vec<PythPostIx>,
}

impl PostRefreshSchedule {
    pub fn new(bundle_target_slot: u64) -> Self {
        Self { bundle_target_slot, posts: Vec::new() }
    }

    pub fn push(&mut self, ix: PythPostIx) {
        self.posts.push(ix);
    }

    /// All posts must satisfy the freshness gate before the bundle is
    /// composed. Returns the first failure as the directive expects
    /// the bundle to abort on any single stale price.
    pub fn validate(&self) -> Result<(), crate::freshness::FreshnessError> {
        for p in &self.posts {
            crate::freshness::verify_freshness(
                p.posted_slot,
                self.bundle_target_slot,
                p.confidence_bps,
            )?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ix(slot: u64, conf: u32) -> PythPostIx {
        PythPostIx::new([1u8; 32], [2u8; 32], slot, conf)
    }

    #[test]
    fn schedule_validates_all_posts() {
        let mut s = PostRefreshSchedule::new(100);
        s.push(ix(98, 30));
        s.push(ix(99, 40));
        s.validate().unwrap();
    }

    #[test]
    fn one_stale_post_fails_whole_schedule() {
        let mut s = PostRefreshSchedule::new(100);
        s.push(ix(98, 30));
        s.push(ix(50, 30)); // 50 slots stale
        assert!(s.validate().is_err());
    }

    #[test]
    fn one_high_confidence_post_fails_schedule() {
        let mut s = PostRefreshSchedule::new(100);
        s.push(ix(98, 30));
        s.push(ix(99, 200)); // 200 bps confidence
        assert!(s.validate().is_err());
    }
}

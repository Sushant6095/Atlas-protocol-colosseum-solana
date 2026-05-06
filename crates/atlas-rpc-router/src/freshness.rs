//! Slot Freshness Monitor (directive §5).
//!
//! Every Atlas proof has a freshness window — `MAX_STALE_SLOTS`
//! (Phase 01 I-3). When `current_slot - last_proof_slot` is close
//! to this number, the next bundle is one slot away from rejecting
//! its own proof. Surfacing this turns "verifiable" from a marketing
//! word into a glanceable infrastructure metric.
//!
//! The monitor exposes a `FreshnessBudget` per active vault and a
//! `ProofPipelineTimeline` drilldown. Both are read-only views; no
//! commitment-path dependency.

use atlas_bus::Pubkey;
use serde::{Deserialize, Serialize};

/// Phase 01 I-3 — proofs older than this many slots are rejected by
/// the on-chain verifier. The off-chain monitor surfaces this as the
/// budget; the on-chain verifier enforces it.
pub const MAX_STALE_SLOTS: u64 = 150;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FreshnessBand {
    /// > 50% of the freshness budget remaining.
    Green,
    /// 10–50% remaining — operator should monitor.
    Amber,
    /// < 10% remaining — next bundle is at risk of rejecting its
    /// own proof. Hard alert.
    Red,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FreshnessBudget {
    pub vault_id: Pubkey,
    pub current_slot: u64,
    pub last_proof_slot: u64,
    pub slot_drift: u64,
    pub freshness_remaining_slots: u64,
    pub verification_window_seconds_remaining: u64,
    pub band: FreshnessBand,
}

impl FreshnessBudget {
    /// Compute the budget for a vault. Caller supplies the current
    /// slot (typically from the same RPC quorum that drives ingestion).
    pub fn compute(vault_id: Pubkey, current_slot: u64, last_proof_slot: u64) -> Self {
        // Saturating: a `last_proof_slot` ahead of the observed slot
        // (which can happen briefly during a quorum lag) collapses
        // drift to zero rather than panicking.
        let slot_drift = current_slot.saturating_sub(last_proof_slot);
        let freshness_remaining_slots = MAX_STALE_SLOTS.saturating_sub(slot_drift);
        // Solana mainnet target slot time = 0.4s. We deliberately
        // round to whole seconds since the monitor is glanceable, not
        // a stopwatch.
        let verification_window_seconds_remaining =
            (freshness_remaining_slots * 4 + 5) / 10;
        let band = freshness_band(freshness_remaining_slots);
        Self {
            vault_id,
            current_slot,
            last_proof_slot,
            slot_drift,
            freshness_remaining_slots,
            verification_window_seconds_remaining,
            band,
        }
    }
}

/// Map a remaining-slots count to a freshness band per directive §5.1.
pub fn freshness_band(freshness_remaining_slots: u64) -> FreshnessBand {
    let half = MAX_STALE_SLOTS / 2;
    let tenth = MAX_STALE_SLOTS / 10;
    if freshness_remaining_slots > half {
        FreshnessBand::Green
    } else if freshness_remaining_slots >= tenth {
        FreshnessBand::Amber
    } else {
        FreshnessBand::Red
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProofPipelineStage {
    Ingest,
    Infer,
    Consensus,
    Prove,
    Submit,
}

impl ProofPipelineStage {
    pub fn name(self) -> &'static str {
        match self {
            ProofPipelineStage::Ingest => "ingest",
            ProofPipelineStage::Infer => "infer",
            ProofPipelineStage::Consensus => "consensus",
            ProofPipelineStage::Prove => "prove",
            ProofPipelineStage::Submit => "submit",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProofPipelineTimeline {
    pub vault_id: Pubkey,
    pub bundle_id: [u8; 32],
    pub stage_durations_ms: Vec<(ProofPipelineStage, u32)>,
}

impl ProofPipelineTimeline {
    pub fn total_ms(&self) -> u32 {
        self.stage_durations_ms.iter().map(|(_, ms)| *ms).sum()
    }

    /// Returns the stage that contributed the most wall time.
    /// Operators use this to triage where a slow rebalance spent its
    /// budget.
    pub fn dominant_stage(&self) -> Option<ProofPipelineStage> {
        self.stage_durations_ms
            .iter()
            .max_by_key(|(_, ms)| *ms)
            .map(|(s, _)| *s)
    }

    pub fn fraction_bps(&self, stage: ProofPipelineStage) -> u32 {
        let total = self.total_ms() as u64;
        if total == 0 {
            return 0;
        }
        let stage_ms = self
            .stage_durations_ms
            .iter()
            .filter(|(s, _)| *s == stage)
            .map(|(_, ms)| *ms as u64)
            .sum::<u64>();
        ((stage_ms.saturating_mul(10_000)) / total) as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn green_band_when_lots_of_budget() {
        let b = FreshnessBudget::compute([1u8; 32], 1_000, 990);
        assert_eq!(b.slot_drift, 10);
        assert_eq!(b.band, FreshnessBand::Green);
        assert_eq!(b.freshness_remaining_slots, MAX_STALE_SLOTS - 10);
    }

    #[test]
    fn amber_band_in_middle() {
        // drift = 100; remaining = 50; half = 75; tenth = 15. 50 ∈ [15, 75].
        let b = FreshnessBudget::compute([1u8; 32], 1_100, 1_000);
        assert_eq!(b.slot_drift, 100);
        assert_eq!(b.band, FreshnessBand::Amber);
    }

    #[test]
    fn red_band_when_almost_expired() {
        // drift = 145; remaining = 5; tenth = 15. 5 < 15.
        let b = FreshnessBudget::compute([1u8; 32], 1_145, 1_000);
        assert_eq!(b.band, FreshnessBand::Red);
    }

    #[test]
    fn verification_window_seconds_rounds_correctly() {
        // remaining_slots=10 → 10 * 0.4 = 4s
        let b = FreshnessBudget::compute([1u8; 32], 1_000, 1_000 - (MAX_STALE_SLOTS - 10));
        assert_eq!(b.freshness_remaining_slots, 10);
        assert_eq!(b.verification_window_seconds_remaining, 4);
    }

    #[test]
    fn last_proof_slot_ahead_of_current_clamps_to_zero() {
        let b = FreshnessBudget::compute([1u8; 32], 1_000, 1_010);
        assert_eq!(b.slot_drift, 0);
        assert_eq!(b.band, FreshnessBand::Green);
    }

    #[test]
    fn drift_past_max_slot_caps_at_zero_remaining() {
        let b = FreshnessBudget::compute([1u8; 32], 1_000, 800);
        assert_eq!(b.slot_drift, 200);
        assert_eq!(b.freshness_remaining_slots, 0);
        assert_eq!(b.band, FreshnessBand::Red);
    }

    fn timeline() -> ProofPipelineTimeline {
        ProofPipelineTimeline {
            vault_id: [1u8; 32],
            bundle_id: [9u8; 32],
            stage_durations_ms: vec![
                (ProofPipelineStage::Ingest, 200),
                (ProofPipelineStage::Infer, 150),
                (ProofPipelineStage::Consensus, 50),
                (ProofPipelineStage::Prove, 60_000),
                (ProofPipelineStage::Submit, 600),
            ],
        }
    }

    #[test]
    fn timeline_total_sums_stages() {
        assert_eq!(timeline().total_ms(), 61_000);
    }

    #[test]
    fn timeline_dominant_stage_is_prove() {
        assert_eq!(timeline().dominant_stage(), Some(ProofPipelineStage::Prove));
    }

    #[test]
    fn timeline_fraction_bps_correct_for_prove() {
        // prove = 60_000 / 61_000 ≈ 9_836 bps
        let f = timeline().fraction_bps(ProofPipelineStage::Prove);
        assert!(f >= 9_800 && f <= 9_900);
    }

    #[test]
    fn band_boundaries_strictly_at_half_and_tenth() {
        // Just over half — green.
        assert_eq!(freshness_band(76), FreshnessBand::Green);
        // Exactly half — amber.
        assert_eq!(freshness_band(75), FreshnessBand::Amber);
        // Just over a tenth — amber.
        assert_eq!(freshness_band(15), FreshnessBand::Amber);
        // Below tenth — red.
        assert_eq!(freshness_band(14), FreshnessBand::Red);
    }
}

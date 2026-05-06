//! Slot-drift attribution (directive §3).
//!
//! When the quorum engine detects disagreement, this module
//! attributes which source caused it. Attribution feeds the
//! reliability EMA (Phase 02 §3) and the `/infra` heatmap.
//!
//! The algorithm is straightforward: the canonical data hash is the
//! mode of the per-source samples; sources whose sample matches the
//! mode are `Consistent`, sources that differ are `Outlier`.
//! Attribution distinguishes `SlotSkew` (lagging by N slots but
//! otherwise consistent — a soft fault) from `ContentDivergence`
//! (different state at the same slot — a hard fault).

use crate::router::QuorumPath;
use atlas_bus::SourceId;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Outlier-share threshold (bps) above which an outlier source is
/// recommended for quarantine. Tuned to match Phase 02's
/// `reliability_quarantine_bps = 4_000`.
pub const OUTLIER_QUARANTINE_BPS: u32 = 4_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttributionVerdict {
    Consistent,
    /// Source's sample matched canonical content but lagged by ≥ 1
    /// slot. Soft fault.
    SlotSkew,
    /// Source's sample diverged on content at the canonical slot.
    /// Hard fault.
    ContentDivergence,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DisagreementKind {
    /// At least one source differs but a majority exists.
    Hard,
    /// No majority — every source disagrees.
    Total,
    /// All sources agree on content; one or more lag on slot.
    Soft,
    /// Single sample, no quorum.
    InsufficientQuorum,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttributionEntry {
    pub source: SourceId,
    pub verdict: AttributionVerdict,
    pub observed_slot: u64,
    pub observed_data_hash: [u8; 32],
    pub canonical_slot: u64,
    pub canonical_data_hash: [u8; 32],
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct AttributionEngine {
    /// Per-source counts. Tuple = (consistent, slot_skew,
    /// content_divergence). Window-bounded by the caller.
    counts: BTreeMap<SourceId, (u64, u64, u64)>,
}

impl AttributionEngine {
    pub fn new() -> Self { Self::default() }

    /// Classify a quorum path's disagreement (or non-disagreement)
    /// and roll the per-source counters. Returns the per-source
    /// verdict list so callers can persist it to the warehouse +
    /// /infra log.
    pub fn record(&mut self, path: &QuorumPath) -> (DisagreementKind, Vec<AttributionEntry>) {
        if path.samples.len() < 2 {
            return (DisagreementKind::InsufficientQuorum, Vec::new());
        }
        let kind = classify(path);
        let mut entries = Vec::with_capacity(path.samples.len());
        for s in &path.samples {
            let verdict = if s.data_hash == path.canonical_data_hash {
                if s.slot < path.canonical_slot {
                    AttributionVerdict::SlotSkew
                } else {
                    AttributionVerdict::Consistent
                }
            } else {
                AttributionVerdict::ContentDivergence
            };
            entries.push(AttributionEntry {
                source: s.source,
                verdict,
                observed_slot: s.slot,
                observed_data_hash: s.data_hash,
                canonical_slot: path.canonical_slot,
                canonical_data_hash: path.canonical_data_hash,
            });
            let counts = self.counts.entry(s.source).or_insert((0, 0, 0));
            match verdict {
                AttributionVerdict::Consistent => counts.0 += 1,
                AttributionVerdict::SlotSkew => counts.1 += 1,
                AttributionVerdict::ContentDivergence => counts.2 += 1,
            }
        }
        (kind, entries)
    }

    /// Outlier share (bps) for one source over all observations
    /// recorded so far. Outliers = `slot_skew + content_divergence`.
    pub fn outlier_share_bps(&self, source: SourceId) -> u32 {
        let (c, s, d) = self.counts.get(&source).copied().unwrap_or((0, 0, 0));
        let total = c + s + d;
        if total == 0 {
            return 0;
        }
        let outliers = s + d;
        ((outliers.saturating_mul(10_000)) / total) as u32
    }

    /// Per-source quarantine recommendation. Returns sources whose
    /// outlier share has crossed `OUTLIER_QUARANTINE_BPS`.
    pub fn quarantine_candidates(&self) -> Vec<SourceId> {
        self.counts
            .keys()
            .copied()
            .filter(|src| self.outlier_share_bps(*src) >= OUTLIER_QUARANTINE_BPS)
            .collect()
    }

    /// Heatmap snapshot: `(source, consistent_count, slot_skew_count,
    /// content_divergence_count)`. Drives the /infra heatmap panel.
    pub fn heatmap_snapshot(&self) -> Vec<(SourceId, u64, u64, u64)> {
        self.counts.iter().map(|(s, (c, sk, cd))| (*s, *c, *sk, *cd)).collect()
    }

    /// Per-source observation totals (consistent + skew + divergence).
    pub fn observations_for(&self, source: SourceId) -> u64 {
        let (c, s, d) = self.counts.get(&source).copied().unwrap_or((0, 0, 0));
        c + s + d
    }
}

fn classify(path: &QuorumPath) -> DisagreementKind {
    let mut hashes: BTreeMap<[u8; 32], u32> = BTreeMap::new();
    for s in &path.samples {
        *hashes.entry(s.data_hash).or_insert(0) += 1;
    }
    if hashes.len() == 1 {
        // All sources agree on content — Soft (only slot may lag).
        // The per-source AttributionEntries distinguish lag vs clean.
        return DisagreementKind::Soft;
    }
    let max = hashes.values().copied().max().unwrap_or(0);
    let n = path.samples.len() as u32;
    if max * 2 <= n {
        DisagreementKind::Total
    } else {
        DisagreementKind::Hard
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::router::AccountResult;

    fn sample(src: SourceId, slot: u64, hash: [u8; 32]) -> AccountResult {
        AccountResult {
            pubkey: [1u8; 32],
            slot,
            data_hash: hash,
            source: src,
            latency_ms: 100,
        }
    }

    fn path(samples: Vec<AccountResult>, canon_hash: [u8; 32], canon_slot: u64) -> QuorumPath {
        QuorumPath { canonical_data_hash: canon_hash, canonical_slot: canon_slot, samples }
    }

    #[test]
    fn all_agree_marks_every_source_consistent() {
        let mut eng = AttributionEngine::new();
        let p = path(
            vec![
                sample(SourceId::YellowstoneTriton, 1_000, [9u8; 32]),
                sample(SourceId::YellowstoneHelius, 1_000, [9u8; 32]),
            ],
            [9u8; 32],
            1_000,
        );
        let (_, entries) = eng.record(&p);
        assert!(entries.iter().all(|e| e.verdict == AttributionVerdict::Consistent));
    }

    #[test]
    fn slot_skew_classified_correctly() {
        let mut eng = AttributionEngine::new();
        let p = path(
            vec![
                sample(SourceId::YellowstoneTriton, 1_000, [9u8; 32]),
                sample(SourceId::YellowstoneHelius, 998, [9u8; 32]),
            ],
            [9u8; 32],
            1_000,
        );
        let (_, entries) = eng.record(&p);
        let helius = entries.iter().find(|e| e.source == SourceId::YellowstoneHelius).unwrap();
        assert_eq!(helius.verdict, AttributionVerdict::SlotSkew);
    }

    #[test]
    fn content_divergence_classified_correctly() {
        let mut eng = AttributionEngine::new();
        let p = path(
            vec![
                sample(SourceId::YellowstoneTriton, 1_000, [9u8; 32]),
                sample(SourceId::YellowstoneHelius, 1_000, [9u8; 32]),
                sample(SourceId::YellowstoneQuickNode, 1_000, [0xff; 32]),
            ],
            [9u8; 32],
            1_000,
        );
        let (kind, entries) = eng.record(&p);
        assert_eq!(kind, DisagreementKind::Hard);
        let qn = entries.iter().find(|e| e.source == SourceId::YellowstoneQuickNode).unwrap();
        assert_eq!(qn.verdict, AttributionVerdict::ContentDivergence);
    }

    #[test]
    fn total_disagreement_when_no_majority() {
        let mut eng = AttributionEngine::new();
        let p = path(
            vec![
                sample(SourceId::YellowstoneTriton, 1_000, [1u8; 32]),
                sample(SourceId::YellowstoneHelius, 1_000, [2u8; 32]),
                sample(SourceId::YellowstoneQuickNode, 1_000, [3u8; 32]),
            ],
            [1u8; 32],
            1_000,
        );
        let (kind, _) = eng.record(&p);
        assert_eq!(kind, DisagreementKind::Total);
    }

    #[test]
    fn outlier_share_grows_with_divergence() {
        let mut eng = AttributionEngine::new();
        // 1 consistent observation.
        eng.record(&path(
            vec![
                sample(SourceId::YellowstoneTriton, 1_000, [9u8; 32]),
                sample(SourceId::YellowstoneHelius, 1_000, [9u8; 32]),
            ],
            [9u8; 32],
            1_000,
        ));
        // 1 divergent observation for QuickNode.
        eng.record(&path(
            vec![
                sample(SourceId::YellowstoneTriton, 1_001, [9u8; 32]),
                sample(SourceId::YellowstoneHelius, 1_001, [9u8; 32]),
                sample(SourceId::YellowstoneQuickNode, 1_001, [0xff; 32]),
            ],
            [9u8; 32],
            1_001,
        ));
        assert_eq!(eng.outlier_share_bps(SourceId::YellowstoneQuickNode), 10_000);
        assert_eq!(eng.outlier_share_bps(SourceId::YellowstoneTriton), 0);
    }

    #[test]
    fn quarantine_candidates_picks_high_outlier_sources() {
        let mut eng = AttributionEngine::new();
        for _ in 0..5 {
            eng.record(&path(
                vec![
                    sample(SourceId::YellowstoneTriton, 1_000, [9u8; 32]),
                    sample(SourceId::YellowstoneHelius, 1_000, [9u8; 32]),
                    sample(SourceId::YellowstoneQuickNode, 1_000, [0xff; 32]),
                ],
                [9u8; 32],
                1_000,
            ));
        }
        let q = eng.quarantine_candidates();
        assert!(q.contains(&SourceId::YellowstoneQuickNode));
        assert!(!q.contains(&SourceId::YellowstoneTriton));
    }

    #[test]
    fn insufficient_quorum_is_skipped() {
        let mut eng = AttributionEngine::new();
        let p = path(
            vec![sample(SourceId::YellowstoneTriton, 1_000, [9u8; 32])],
            [9u8; 32],
            1_000,
        );
        let (kind, entries) = eng.record(&p);
        assert_eq!(kind, DisagreementKind::InsufficientQuorum);
        assert!(entries.is_empty());
    }

    #[test]
    fn heatmap_snapshot_carries_counts() {
        let mut eng = AttributionEngine::new();
        eng.record(&path(
            vec![
                sample(SourceId::YellowstoneTriton, 1_000, [9u8; 32]),
                sample(SourceId::YellowstoneHelius, 1_000, [9u8; 32]),
                sample(SourceId::YellowstoneQuickNode, 1_000, [0xff; 32]),
            ],
            [9u8; 32],
            1_000,
        ));
        let snap = eng.heatmap_snapshot();
        assert_eq!(snap.len(), 3);
        let qn = snap.iter().find(|(s, _, _, _)| *s == SourceId::YellowstoneQuickNode).unwrap();
        assert_eq!(qn.3, 1);
    }
}

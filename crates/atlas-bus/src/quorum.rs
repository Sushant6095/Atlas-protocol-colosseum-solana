//! Quorum engine — cross-validates events from multiple sources before they
//! land on the commitment channel.
//!
//! Policy:
//!   - `min_sources` providers must agree by content hash within
//!     `agreement_slot_window` slots.
//!   - Disagreement classes:
//!       Soft  — content matches but slot lags by ≤ window
//!       Hard  — content mismatch within window
//!       Total — all sources differ
//!   - Reliability EMA per source updates on every observation; sources below
//!     threshold are quarantined for `quarantine_slots`.
//!   - Geographic diversity guard: at least two distinct AS / cloud regions.

use crate::event::{AtlasEvent, SourceId};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug)]
pub struct QuorumPolicy {
    pub min_sources: u8,
    pub agreement_slot_window: u64,
    /// Threshold below which a source is quarantined (bps; 10_000 = perfect).
    pub reliability_quarantine_bps: u32,
    pub quarantine_slots: u64,
    /// Smoothing factor for reliability EMA; 500 bps ≈ 5%.
    pub ema_alpha_bps: u32,
}

impl Default for QuorumPolicy {
    fn default() -> Self {
        Self {
            min_sources: 2,
            agreement_slot_window: 4,
            reliability_quarantine_bps: 4_000,
            quarantine_slots: 64,
            ema_alpha_bps: 500,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QuorumOutcome {
    /// Cross-validated by `count` sources within the window.
    Confirmed { count: u8 },
    /// Same content, lagging slot — emitted with degraded confidence.
    Soft { lag_slots: u64 },
    /// Distinct content within window — withhold from commitment, emit alert.
    Hard,
    /// All sources disagree — halt rebalance, keep monitoring.
    Total,
}

impl QuorumOutcome {
    pub fn is_committable(self) -> bool {
        matches!(self, QuorumOutcome::Confirmed { .. })
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ReliabilityScore {
    pub source: SourceId,
    pub bps: u32,
    pub quarantined_until_slot: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AsRegion {
    Triton,
    Helius,
    QuickNode,
    Other(u32),
}

#[derive(Clone, Copy, Debug)]
pub struct SourceManifest {
    pub source: SourceId,
    pub region: AsRegion,
}

pub struct QuorumEngine {
    policy: QuorumPolicy,
    reliability: BTreeMap<SourceId, ReliabilityScore>,
    manifests: BTreeMap<SourceId, SourceManifest>,
}

impl QuorumEngine {
    pub fn new(policy: QuorumPolicy, manifests: Vec<SourceManifest>) -> Self {
        let mut m = BTreeMap::new();
        for sm in manifests {
            m.insert(sm.source, sm);
        }
        Self { policy, reliability: BTreeMap::new(), manifests: m }
    }

    pub fn policy(&self) -> QuorumPolicy {
        self.policy
    }

    pub fn reliability_for(&self, source: SourceId) -> ReliabilityScore {
        self.reliability.get(&source).copied().unwrap_or(ReliabilityScore {
            source,
            bps: 5_000,
            quarantined_until_slot: 0,
        })
    }

    pub fn record_agreement(&mut self, source: SourceId, current_slot: u64) {
        let prev = self.reliability_for(source);
        let new = ema_step(prev.bps, 10_000, self.policy.ema_alpha_bps);
        self.reliability.insert(
            source,
            ReliabilityScore {
                source,
                bps: new,
                quarantined_until_slot: prev.quarantined_until_slot.max(0),
            },
        );
        let _ = current_slot;
    }

    pub fn record_disagreement(&mut self, source: SourceId, current_slot: u64) {
        let prev = self.reliability_for(source);
        let new = ema_step(prev.bps, 0, self.policy.ema_alpha_bps);
        let mut quarantined_until = prev.quarantined_until_slot;
        if new < self.policy.reliability_quarantine_bps {
            quarantined_until = current_slot.saturating_add(self.policy.quarantine_slots);
        }
        self.reliability.insert(
            source,
            ReliabilityScore {
                source,
                bps: new,
                quarantined_until_slot: quarantined_until,
            },
        );
    }

    pub fn is_quarantined(&self, source: SourceId, current_slot: u64) -> bool {
        self.reliability_for(source).quarantined_until_slot > current_slot
    }

    /// Evaluate a fresh batch of observations for the same logical event
    /// (same `pubkey/feed_id`). Returns the quorum outcome.
    ///
    /// `observations` MUST share a logical anchor (caller pre-groups). Each
    /// item is `(SourceId, content_hash, slot)`.
    pub fn evaluate(
        &mut self,
        observations: &[(SourceId, [u8; 32], u64)],
        current_slot: u64,
    ) -> QuorumOutcome {
        let mut active: Vec<(SourceId, [u8; 32], u64)> = observations
            .iter()
            .copied()
            .filter(|(s, _, _)| !self.is_quarantined(*s, current_slot))
            .collect();
        active.sort_by_key(|(s, _, _)| *s as u8);
        if active.is_empty() {
            return QuorumOutcome::Total;
        }

        // Group by content hash.
        let mut groups: BTreeMap<[u8; 32], Vec<(SourceId, u64)>> = BTreeMap::new();
        for (s, h, slot) in &active {
            groups.entry(*h).or_default().push((*s, *slot));
        }

        // Find the largest group within the slot window.
        let mut best: Option<(usize, u64, &Vec<(SourceId, u64)>)> = None;
        for entries in groups.values() {
            let max = entries.iter().map(|(_, s)| *s).max().unwrap_or(0);
            let min = entries.iter().map(|(_, s)| *s).min().unwrap_or(0);
            let span = max.saturating_sub(min);
            if span <= self.policy.agreement_slot_window {
                let count = entries.len();
                let key = (count, max, entries);
                if let Some(b) = best {
                    if key.0 > b.0 {
                        best = Some(key);
                    }
                } else {
                    best = Some(key);
                }
            }
        }

        // Disagreement classification rules:
        //   1. A group meets `min_sources` AND spans ≥2 distinct regions → Confirmed.
        //   2. A group meets `min_sources` but only one region          → Soft (degraded confidence).
        //   3. No group passed the slot window (lag too large for ALL)   → Hard (agreement window violation).
        //   4. Single source observed                                    → Soft (insufficient sources).
        //   5. Multiple sources, every content hash distinct             → Total disagreement.
        //   6. Multiple groups in window, no quorum                      → Hard disagreement.
        //   7. Single group in window, insufficient sources              → Soft.
        let outcome = if let Some((count, _max_slot, entries)) = best.filter(|(c, _, _)| (*c as u8) >= self.policy.min_sources) {
            let mut regions = std::collections::BTreeSet::new();
            for (s, _) in entries {
                if let Some(m) = self.manifests.get(s) {
                    regions.insert(format!("{:?}", m.region));
                } else {
                    regions.insert(format!("{:?}", s));
                }
            }
            if regions.len() < 2 {
                QuorumOutcome::Soft { lag_slots: 0 }
            } else {
                QuorumOutcome::Confirmed { count: count as u8 }
            }
        } else if best.is_none() {
            // No group satisfied the slot window — every observation is too
            // stale relative to the freshest. That is a hard disagreement.
            if groups.len() == active.len() && active.len() > 1 {
                QuorumOutcome::Total
            } else {
                QuorumOutcome::Hard
            }
        } else if active.len() <= 1 {
            QuorumOutcome::Soft { lag_slots: 0 }
        } else if groups.len() == active.len() {
            QuorumOutcome::Total
        } else if groups.len() > 1 {
            QuorumOutcome::Hard
        } else {
            // Single group in window, insufficient sources.
            let lag = best
                .map(|(_, _, entries)| {
                    let max = entries.iter().map(|(_, s)| *s).max().unwrap_or(0);
                    let min = entries.iter().map(|(_, s)| *s).min().unwrap_or(0);
                    max - min
                })
                .unwrap_or(0);
            QuorumOutcome::Soft { lag_slots: lag }
        };

        // Update reliability EMA for the active providers.
        if let QuorumOutcome::Confirmed { .. } = outcome {
            // Sources in the winning group → +reliability; outliers → -reliability.
            if let Some((_, _, entries)) = best {
                let in_quorum: std::collections::BTreeSet<SourceId> =
                    entries.iter().map(|(s, _)| *s).collect();
                for (s, _, _) in &active {
                    if in_quorum.contains(s) {
                        self.record_agreement(*s, current_slot);
                    } else {
                        self.record_disagreement(*s, current_slot);
                    }
                }
            }
        } else if matches!(outcome, QuorumOutcome::Hard | QuorumOutcome::Total) {
            for (s, _, _) in &active {
                self.record_disagreement(*s, current_slot);
            }
        }

        // Helper: silence unused parameter linting if removed downstream.
        let _ = AtlasEvent::SlotAdvance { slot: 0, leader: [0; 32], parent: 0 };
        outcome
    }
}

fn ema_step(prev: u32, new: u32, alpha_bps: u32) -> u32 {
    let prev = prev as u64;
    let new = new as u64;
    let alpha = alpha_bps as u64;
    let blended = (prev * (10_000 - alpha) + new * alpha) / 10_000;
    blended.min(10_000) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifests() -> Vec<SourceManifest> {
        vec![
            SourceManifest {
                source: SourceId::YellowstoneTriton,
                region: AsRegion::Triton,
            },
            SourceManifest {
                source: SourceId::YellowstoneHelius,
                region: AsRegion::Helius,
            },
            SourceManifest {
                source: SourceId::YellowstoneQuickNode,
                region: AsRegion::QuickNode,
            },
        ]
    }

    #[test]
    fn confirmed_when_two_distinct_regions_agree() {
        let mut q = QuorumEngine::new(QuorumPolicy::default(), manifests());
        let h = [9u8; 32];
        let obs = vec![
            (SourceId::YellowstoneTriton, h, 100),
            (SourceId::YellowstoneHelius, h, 102),
        ];
        let outcome = q.evaluate(&obs, 102);
        assert!(matches!(outcome, QuorumOutcome::Confirmed { count: 2 }));
        assert!(outcome.is_committable());
    }

    #[test]
    fn soft_when_only_one_region_present() {
        let mut q = QuorumEngine::new(QuorumPolicy::default(), manifests());
        let h = [9u8; 32];
        let obs = vec![(SourceId::YellowstoneTriton, h, 100)];
        let outcome = q.evaluate(&obs, 100);
        // single source — fails min_sources, goes Soft (one group, lag 0).
        assert!(matches!(outcome, QuorumOutcome::Soft { .. }));
        assert!(!outcome.is_committable());
    }

    #[test]
    fn hard_disagreement_when_content_differs_within_window() {
        let mut q = QuorumEngine::new(QuorumPolicy::default(), manifests());
        let obs = vec![
            (SourceId::YellowstoneTriton, [1u8; 32], 100),
            (SourceId::YellowstoneHelius, [2u8; 32], 100),
        ];
        let outcome = q.evaluate(&obs, 100);
        // Two single-element groups → Hard
        assert!(matches!(outcome, QuorumOutcome::Hard | QuorumOutcome::Total));
    }

    #[test]
    fn total_disagreement_three_sources_distinct() {
        let mut q = QuorumEngine::new(QuorumPolicy::default(), manifests());
        let obs = vec![
            (SourceId::YellowstoneTriton, [1u8; 32], 100),
            (SourceId::YellowstoneHelius, [2u8; 32], 100),
            (SourceId::YellowstoneQuickNode, [3u8; 32], 100),
        ];
        let outcome = q.evaluate(&obs, 100);
        assert!(matches!(outcome, QuorumOutcome::Total));
    }

    #[test]
    fn slot_window_respected() {
        let mut q = QuorumEngine::new(QuorumPolicy::default(), manifests());
        let h = [9u8; 32];
        let obs = vec![
            (SourceId::YellowstoneTriton, h, 100),
            (SourceId::YellowstoneHelius, h, 200), // far outside window
        ];
        let outcome = q.evaluate(&obs, 200);
        // Both groups are single-element after window check → Hard
        assert!(matches!(outcome, QuorumOutcome::Hard | QuorumOutcome::Total));
    }

    #[test]
    fn reliability_quarantines_bad_source() {
        let mut q = QuorumEngine::new(QuorumPolicy::default(), manifests());
        // Hammer one source with disagreements until reliability collapses.
        for slot in 0..200u64 {
            q.record_disagreement(SourceId::YellowstoneQuickNode, slot);
        }
        assert!(q.is_quarantined(SourceId::YellowstoneQuickNode, 200));
    }

    #[test]
    fn reliability_recovers_on_agreement() {
        let mut q = QuorumEngine::new(QuorumPolicy::default(), manifests());
        for slot in 0..50u64 {
            q.record_disagreement(SourceId::YellowstoneTriton, slot);
        }
        let low = q.reliability_for(SourceId::YellowstoneTriton).bps;
        for slot in 50..200u64 {
            q.record_agreement(SourceId::YellowstoneTriton, slot);
        }
        let high = q.reliability_for(SourceId::YellowstoneTriton).bps;
        assert!(high > low);
    }
}

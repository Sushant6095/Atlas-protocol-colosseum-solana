//! Hot / warm / cold tier failover (directive §4).
//!
//! Each `SourceId` has an assigned tier:
//!   - `Hot`  — primary stream, full bandwidth
//!   - `Warm` — backup polling at degraded cadence; ready to promote
//!   - `Cold` — dormant
//!
//! Hot failure promotes a warm source within 1 slot. Promotion is
//! deterministic (sort by `(tier, source_id)`) so the same input produces
//! the same promotion sequence on every replay.

use crate::event::SourceId;
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum SourceTier {
    Hot = 0,
    Warm = 1,
    Cold = 2,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TierState {
    pub source: SourceId,
    pub tier: SourceTier,
    pub last_event_slot: u64,
    pub failure_count: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TierTransition {
    Promoted { source: SourceId, from: SourceTier, to: SourceTier, at_slot: u64 },
    Demoted { source: SourceId, from: SourceTier, to: SourceTier, at_slot: u64 },
}

#[derive(Clone, Copy, Debug)]
pub struct FailoverPolicy {
    /// Slots without an event before a `Hot` source is considered failed.
    pub hot_stall_slots: u64,
    /// Slots between `Warm` poll cycles. Lower = more redundancy, more cost.
    pub warm_poll_interval_slots: u64,
    /// Maximum failure_count before forced demotion to `Cold`.
    pub max_failures: u32,
}

impl Default for FailoverPolicy {
    fn default() -> Self {
        Self {
            hot_stall_slots: 4,
            warm_poll_interval_slots: 16,
            max_failures: 5,
        }
    }
}

pub struct FailoverEngine {
    policy: FailoverPolicy,
    sources: BTreeMap<SourceId, TierState>,
}

impl FailoverEngine {
    pub fn new(policy: FailoverPolicy, initial: Vec<TierState>) -> Self {
        let mut m = BTreeMap::new();
        for s in initial {
            m.insert(s.source, s);
        }
        Self { policy, sources: m }
    }

    pub fn upsert(&mut self, state: TierState) {
        self.sources.insert(state.source, state);
    }

    pub fn tier_of(&self, source: SourceId) -> Option<SourceTier> {
        self.sources.get(&source).map(|s| s.tier)
    }

    pub fn record_event(&mut self, source: SourceId, slot: u64) {
        if let Some(s) = self.sources.get_mut(&source) {
            s.last_event_slot = s.last_event_slot.max(slot);
            s.failure_count = 0;
        }
    }

    pub fn record_failure(&mut self, source: SourceId) {
        if let Some(s) = self.sources.get_mut(&source) {
            s.failure_count = s.failure_count.saturating_add(1);
        }
    }

    /// Evaluate at slot `now` and emit any tier transitions.
    /// Promotion ordering is deterministic: lowest `SourceId` discriminant first.
    pub fn evaluate(&mut self, now: u64) -> Vec<TierTransition> {
        let mut transitions = Vec::new();

        // Detect failed Hot sources.
        let failed_hot: Vec<SourceId> = self
            .sources
            .values()
            .filter(|s| {
                s.tier == SourceTier::Hot
                    && (now.saturating_sub(s.last_event_slot) > self.policy.hot_stall_slots
                        || s.failure_count >= self.policy.max_failures)
            })
            .map(|s| s.source)
            .collect();

        for hot in &failed_hot {
            if let Some(s) = self.sources.get_mut(hot) {
                let from = s.tier;
                s.tier = SourceTier::Cold;
                transitions.push(TierTransition::Demoted {
                    source: *hot,
                    from,
                    to: SourceTier::Cold,
                    at_slot: now,
                });
            }
        }

        // For each demoted Hot, promote a deterministic Warm.
        for _ in 0..failed_hot.len() {
            // Lowest-discriminant Warm wins.
            let promote_target = self
                .sources
                .values()
                .filter(|s| s.tier == SourceTier::Warm)
                .map(|s| s.source)
                .min_by_key(|s| *s as u8);
            if let Some(target) = promote_target {
                if let Some(s) = self.sources.get_mut(&target) {
                    let from = s.tier;
                    s.tier = SourceTier::Hot;
                    s.failure_count = 0;
                    transitions.push(TierTransition::Promoted {
                        source: target,
                        from,
                        to: SourceTier::Hot,
                        at_slot: now,
                    });
                }
            }
        }

        transitions
    }

    pub fn snapshot(&self) -> Vec<TierState> {
        self.sources.values().copied().collect()
    }

    pub fn policy(&self) -> FailoverPolicy {
        self.policy
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(s: SourceId, tier: SourceTier, last_slot: u64) -> TierState {
        TierState {
            source: s,
            tier,
            last_event_slot: last_slot,
            failure_count: 0,
        }
    }

    #[test]
    fn hot_source_stalled_demotes_to_cold() {
        let mut eng = FailoverEngine::new(
            FailoverPolicy::default(),
            vec![
                state(SourceId::YellowstoneTriton, SourceTier::Hot, 100),
                state(SourceId::YellowstoneHelius, SourceTier::Warm, 100),
            ],
        );
        let trans = eng.evaluate(120); // 20 slots > hot_stall_slots=4
        assert!(trans.iter().any(|t| matches!(t, TierTransition::Demoted { source: SourceId::YellowstoneTriton, .. })));
        assert!(trans.iter().any(|t| matches!(t, TierTransition::Promoted { source: SourceId::YellowstoneHelius, .. })));
        assert_eq!(eng.tier_of(SourceId::YellowstoneTriton), Some(SourceTier::Cold));
        assert_eq!(eng.tier_of(SourceId::YellowstoneHelius), Some(SourceTier::Hot));
    }

    #[test]
    fn deterministic_promotion_order() {
        let mut eng_a = FailoverEngine::new(
            FailoverPolicy::default(),
            vec![
                state(SourceId::YellowstoneTriton, SourceTier::Hot, 0),
                state(SourceId::YellowstoneHelius, SourceTier::Warm, 0),
                state(SourceId::YellowstoneQuickNode, SourceTier::Warm, 0),
            ],
        );
        let mut eng_b = FailoverEngine::new(
            FailoverPolicy::default(),
            vec![
                state(SourceId::YellowstoneQuickNode, SourceTier::Warm, 0),
                state(SourceId::YellowstoneHelius, SourceTier::Warm, 0),
                state(SourceId::YellowstoneTriton, SourceTier::Hot, 0),
            ],
        );
        let ta = eng_a.evaluate(100);
        let tb = eng_b.evaluate(100);
        assert_eq!(ta, tb);
    }

    #[test]
    fn record_event_clears_failures() {
        let mut eng = FailoverEngine::new(
            FailoverPolicy::default(),
            vec![state(SourceId::PythHermes, SourceTier::Hot, 0)],
        );
        eng.record_failure(SourceId::PythHermes);
        eng.record_failure(SourceId::PythHermes);
        eng.record_event(SourceId::PythHermes, 50);
        let snap = eng.snapshot();
        assert_eq!(snap[0].failure_count, 0);
        assert_eq!(snap[0].last_event_slot, 50);
    }

    #[test]
    fn no_warm_to_promote_keeps_hot_demoted() {
        let mut eng = FailoverEngine::new(
            FailoverPolicy::default(),
            vec![state(SourceId::YellowstoneTriton, SourceTier::Hot, 0)],
        );
        let trans = eng.evaluate(100);
        assert!(trans.iter().any(|t| matches!(t, TierTransition::Demoted { .. })));
        assert!(!trans.iter().any(|t| matches!(t, TierTransition::Promoted { .. })));
    }
}

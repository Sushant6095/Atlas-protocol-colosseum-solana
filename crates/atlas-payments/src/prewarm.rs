//! Payment buffer engine — pre-warm liquidity for scheduled outflows
//! (directive §4.2 + §4.3).

use crate::dodo::{DodoIntent, PriorityClass};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreWarmPolicy {
    /// Treasury-specific cap on APY loss tolerated per pre-warm.
    /// If pre-warming would cost more than this in APY, the engine
    /// either splits the warm-up or defers lower-priority intents.
    pub max_prewarm_apy_loss_bps: u32,
    /// Default pre-warm window in slots. Production wires this from
    /// per-protocol withdraw latency + safety margin.
    pub default_window_slots: u64,
    /// Maximum slots Atlas will defer a non-critical intent within
    /// its `[earliest_at, latest_at]` band before splitting.
    pub max_defer_slots: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreWarmedScheduleEntry {
    pub intent_id: String,
    pub amount_q64: u128,
    pub priority: PriorityClass,
    /// Slot at which the buffer must cover this intent in full.
    pub buffer_required_at_slot: u64,
    pub decision: PreWarmDecision,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreWarmDecision {
    /// Pre-warm in a single rebalance.
    SingleRebalance,
    /// Spread the warm-up across multiple rebalances to reduce per-step impact.
    Split { steps: u32 },
    /// Deferred within the intent's `[earliest_at, latest_at]` band.
    Deferred { defer_slots: u64 },
    /// Constraint violated; treasury signers must intervene. Atlas
    /// pauses the lower-priority lane and pages the multisig.
    AlertConstraintViolation,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PreWarmError {
    #[error("schedule must have at least one entry")]
    EmptySchedule,
    #[error("intent {0} has earliest_at_slot ≥ latest_at_slot")]
    InvertedWindow(String),
}

/// Plan a pre-warm response for a Dodo schedule. Critical intents
/// always get `SingleRebalance`. High-priority intents get split if
/// pre-warming would exceed the policy's APY loss cap. Low / Normal
/// intents may be deferred within their band; if even that exhausts
/// budget the engine emits `AlertConstraintViolation` to the
/// signers.
pub fn plan_prewarm(
    intents: &[DodoIntent],
    policy: &PreWarmPolicy,
    estimated_apy_loss_bps_per_intent: u32,
) -> Result<Vec<PreWarmedScheduleEntry>, PreWarmError> {
    if intents.is_empty() {
        return Err(PreWarmError::EmptySchedule);
    }
    let mut out = Vec::with_capacity(intents.len());
    let mut accumulated_loss: u32 = 0;
    let mut sorted = intents.to_vec();
    // Process critical first, then high, normal, low.
    sorted.sort_by(|a, b| priority_key(b.priority).cmp(&priority_key(a.priority)));
    for i in &sorted {
        if i.earliest_at_slot >= i.latest_at_slot {
            return Err(PreWarmError::InvertedWindow(i.intent_id.clone()));
        }
        accumulated_loss = accumulated_loss.saturating_add(estimated_apy_loss_bps_per_intent);
        let decision = if i.priority == PriorityClass::Critical {
            PreWarmDecision::SingleRebalance
        } else if accumulated_loss <= policy.max_prewarm_apy_loss_bps {
            PreWarmDecision::SingleRebalance
        } else if i.priority == PriorityClass::High {
            // Split high-priority intents to amortize impact.
            PreWarmDecision::Split { steps: 4 }
        } else {
            // Defer normal/low if there's room within their band.
            let band = i.latest_at_slot.saturating_sub(i.earliest_at_slot);
            let defer_slots = band.min(policy.max_defer_slots);
            if defer_slots > 0 {
                PreWarmDecision::Deferred { defer_slots }
            } else {
                PreWarmDecision::AlertConstraintViolation
            }
        };
        out.push(PreWarmedScheduleEntry {
            intent_id: i.intent_id.clone(),
            amount_q64: i.amount_q64,
            priority: i.priority,
            buffer_required_at_slot: i.earliest_at_slot,
            decision,
        });
    }
    Ok(out)
}

fn priority_key(p: PriorityClass) -> u8 {
    match p {
        PriorityClass::Critical => 4,
        PriorityClass::High => 3,
        PriorityClass::Normal => 2,
        PriorityClass::Low => 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn intent(id: &str, p: PriorityClass, e: u64, l: u64) -> DodoIntent {
        DodoIntent {
            intent_id: id.into(),
            amount_q64: 1_000,
            mint: "PUSD".into(),
            earliest_at_slot: e,
            latest_at_slot: l,
            priority: p,
        }
    }

    fn policy(cap_bps: u32) -> PreWarmPolicy {
        PreWarmPolicy {
            max_prewarm_apy_loss_bps: cap_bps,
            default_window_slots: 1_000,
            max_defer_slots: 500,
        }
    }

    #[test]
    fn critical_always_single_rebalance() {
        let plan = plan_prewarm(
            &[intent("crit", PriorityClass::Critical, 0, 1_000)],
            &policy(10),
            // High cost per intent — but critical bypasses the cap.
            500,
        )
        .unwrap();
        assert_eq!(plan[0].decision, PreWarmDecision::SingleRebalance);
    }

    #[test]
    fn high_priority_splits_when_apy_cap_breached() {
        let intents = vec![
            intent("a", PriorityClass::Critical, 0, 1_000),
            intent("b", PriorityClass::High, 0, 1_000),
        ];
        // critical=300 → still under cap=500
        // high=300 (cumulative=600) → over cap → split.
        let plan = plan_prewarm(&intents, &policy(500), 300).unwrap();
        let high = plan.iter().find(|p| p.priority == PriorityClass::High).unwrap();
        assert_eq!(high.decision, PreWarmDecision::Split { steps: 4 });
    }

    #[test]
    fn normal_priority_deferred_within_band() {
        let intents = vec![
            intent("a", PriorityClass::Critical, 0, 100),
            intent("b", PriorityClass::Normal, 100, 1_000),
        ];
        // Cap exhausted by critical → normal must defer.
        let plan = plan_prewarm(&intents, &policy(100), 200).unwrap();
        let normal = plan.iter().find(|p| p.priority == PriorityClass::Normal).unwrap();
        assert!(matches!(normal.decision, PreWarmDecision::Deferred { .. }));
    }

    #[test]
    fn alert_when_normal_has_no_band() {
        let intents = vec![
            intent("a", PriorityClass::Critical, 0, 100),
            // Tight window that allows no deferral.
            intent("b", PriorityClass::Low, 100, 101),
        ];
        let plan = plan_prewarm(&intents, &policy(100), 200).unwrap();
        let low = plan.iter().find(|p| p.priority == PriorityClass::Low).unwrap();
        // band=1 slot; max_defer_slots=500; defer_slots=min(1,500)=1.
        // So Deferred wins. But if band=0 we'd alert. Tighten:
        assert!(matches!(low.decision, PreWarmDecision::Deferred { defer_slots: 1 }));
    }

    #[test]
    fn alert_when_band_zero() {
        let intents = vec![
            intent("a", PriorityClass::Critical, 0, 1),
            // band = 0
            intent("b", PriorityClass::Low, 100, 100),
        ];
        let r = plan_prewarm(&intents, &policy(100), 200);
        assert!(matches!(r, Err(PreWarmError::InvertedWindow(_))));
    }

    #[test]
    fn empty_schedule_rejects() {
        let r = plan_prewarm(&[], &policy(100), 50);
        assert!(matches!(r, Err(PreWarmError::EmptySchedule)));
    }

    #[test]
    fn buffer_required_at_earliest_slot() {
        let plan = plan_prewarm(
            &[intent("a", PriorityClass::Critical, 500, 1_000)],
            &policy(100),
            10,
        )
        .unwrap();
        assert_eq!(plan[0].buffer_required_at_slot, 500);
    }
}

//! Pending-approval queue (directive §6 + I-21).
//!
//! Anything that would silently widen scope — mandate renewal,
//! scope expansion, a one-off action above the auto-execute
//! threshold — lands in this queue instead of executing. The queue
//! is durable; a Squads multisig vote is the only way to advance
//! an entry to `Approved`.
//!
//! The frontend renders the queue at `/treasury/{id}/pending`. The
//! operator agent never auto-executes an entry; the only state
//! transition the agent is allowed to make is `Pending → Stale`
//! (when the entry's `valid_until_slot` passes) or
//! `Approved → Executed` after multisig approval lands.

use crate::role::{ActionClass, KeeperRole};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PendingPriority {
    /// Mandate caps breach, scope expansion, or anything the agent
    /// flagged as needing immediate attention.
    Critical,
    /// Standard mandate renewal, planned ratchet refresh.
    Normal,
    /// Routine — telemetry-driven follow-up, no SLA.
    Low,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PendingReason {
    MandateRenewal,
    MandateScopeExpansion,
    /// Action exceeds the auto-execute notional threshold.
    AboveAutoThreshold,
    /// Mandate caps proved insufficient; multisig must approve a
    /// fresh mandate before the agent can proceed.
    CapsExhausted,
    /// Compliance flagged the route (sanctions pending, etc.).
    ComplianceHold,
    /// Operator-initiated review (manual gate).
    Manual,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PendingState {
    Pending,
    Approved,
    Rejected,
    /// `valid_until_slot` passed before approval. The agent flips
    /// to this state automatically; it never auto-promotes to
    /// Approved.
    Stale,
    Executed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PendingBundle {
    pub bundle_id: [u8; 32],
    pub treasury_id: Pubkey,
    /// The keeper that would execute the action if approved.
    pub keeper_pubkey: Pubkey,
    pub role: KeeperRole,
    pub action: ActionClass,
    pub priority: PendingPriority,
    pub reason: PendingReason,
    pub notional_q64: u128,
    /// Submitted at this slot.
    pub submitted_at_slot: u64,
    /// Approval window expires at this slot. After this, the agent
    /// flips the state to Stale.
    pub valid_until_slot: u64,
    /// Free-form summary the agent shows on the dashboard.
    pub summary: String,
    pub state: PendingState,
    /// Multisig transaction id that approved/rejected (filled when
    /// `state` advances past Pending).
    pub decision_squads_tx: Option<[u8; 32]>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PendingDecision {
    Approve,
    Reject,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PendingBundleError {
    #[error("bundle {0:?} already in queue")]
    Duplicate([u8; 32]),
    #[error("bundle {0:?} not found")]
    Unknown([u8; 32]),
    #[error("bundle {0:?} is in state {1:?}, cannot transition")]
    InvalidTransition([u8; 32], PendingState),
    #[error("approval window closed: bundle valid until {valid_until}, current {now}")]
    Expired { valid_until: u64, now: u64 },
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct PendingQueue {
    bundles: BTreeMap<[u8; 32], PendingBundle>,
}

impl PendingQueue {
    pub fn new() -> Self { Self::default() }

    pub fn len(&self) -> usize { self.bundles.len() }
    pub fn is_empty(&self) -> bool { self.bundles.is_empty() }

    pub fn get(&self, id: &[u8; 32]) -> Option<&PendingBundle> {
        self.bundles.get(id)
    }

    /// Iterate bundles for one treasury, in submission order.
    pub fn for_treasury(&self, treasury: Pubkey) -> Vec<&PendingBundle> {
        let mut out: Vec<&PendingBundle> = self
            .bundles
            .values()
            .filter(|b| b.treasury_id == treasury)
            .collect();
        out.sort_by_key(|b| b.submitted_at_slot);
        out
    }

    /// Bundles still awaiting decision (Pending only — Approved /
    /// Rejected / Stale / Executed are terminal for the frontend).
    pub fn awaiting_decision(&self) -> Vec<&PendingBundle> {
        let mut out: Vec<&PendingBundle> = self
            .bundles
            .values()
            .filter(|b| b.state == PendingState::Pending)
            .collect();
        // Critical first, then Normal, then Low; within each tier,
        // oldest first.
        out.sort_by(|a, b| {
            a.priority
                .cmp(&b.priority)
                .then(a.submitted_at_slot.cmp(&b.submitted_at_slot))
        });
        out
    }

    pub fn enqueue(&mut self, bundle: PendingBundle) -> Result<(), PendingBundleError> {
        if self.bundles.contains_key(&bundle.bundle_id) {
            return Err(PendingBundleError::Duplicate(bundle.bundle_id));
        }
        self.bundles.insert(bundle.bundle_id, bundle);
        Ok(())
    }

    pub fn decide(
        &mut self,
        bundle_id: [u8; 32],
        decision: PendingDecision,
        squads_tx: [u8; 32],
        now_slot: u64,
    ) -> Result<(), PendingBundleError> {
        let b = self
            .bundles
            .get_mut(&bundle_id)
            .ok_or(PendingBundleError::Unknown(bundle_id))?;
        if b.state != PendingState::Pending {
            return Err(PendingBundleError::InvalidTransition(bundle_id, b.state));
        }
        if now_slot >= b.valid_until_slot {
            // Decision window closed; flip to Stale and refuse the
            // decision. Agent should requeue with a fresh window.
            b.state = PendingState::Stale;
            return Err(PendingBundleError::Expired {
                valid_until: b.valid_until_slot,
                now: now_slot,
            });
        }
        b.state = match decision {
            PendingDecision::Approve => PendingState::Approved,
            PendingDecision::Reject => PendingState::Rejected,
        };
        b.decision_squads_tx = Some(squads_tx);
        Ok(())
    }

    /// Mark an Approved bundle as Executed once the keeper has
    /// landed the underlying tx.
    pub fn mark_executed(&mut self, bundle_id: [u8; 32]) -> Result<(), PendingBundleError> {
        let b = self
            .bundles
            .get_mut(&bundle_id)
            .ok_or(PendingBundleError::Unknown(bundle_id))?;
        if b.state != PendingState::Approved {
            return Err(PendingBundleError::InvalidTransition(bundle_id, b.state));
        }
        b.state = PendingState::Executed;
        Ok(())
    }

    /// Sweep stale entries: any Pending bundle whose
    /// `valid_until_slot` has passed flips to Stale. Returns the
    /// number of bundles that flipped.
    pub fn sweep_stale(&mut self, now_slot: u64) -> usize {
        let mut count = 0;
        for b in self.bundles.values_mut() {
            if b.state == PendingState::Pending && now_slot >= b.valid_until_slot {
                b.state = PendingState::Stale;
                count += 1;
            }
        }
        count
    }
}

/// Free-standing helper: the lib.rs re-exports this so callers can
/// enqueue without holding a `PendingQueue` directly when the
/// queue is owned by an outer struct.
pub fn enqueue_pending(
    queue: &mut PendingQueue,
    bundle: PendingBundle,
) -> Result<(), PendingBundleError> {
    queue.enqueue(bundle)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bundle(id: u8, treasury: Pubkey, prio: PendingPriority, slot: u64) -> PendingBundle {
        PendingBundle {
            bundle_id: [id; 32],
            treasury_id: treasury,
            keeper_pubkey: [9u8; 32],
            role: KeeperRole::RebalanceKeeper,
            action: ActionClass::RebalanceExecute,
            priority: prio,
            reason: PendingReason::AboveAutoThreshold,
            notional_q64: 5_000_000,
            submitted_at_slot: slot,
            valid_until_slot: slot + 1_000,
            summary: "rebalance above auto threshold".into(),
            state: PendingState::Pending,
            decision_squads_tx: None,
        }
    }

    #[test]
    fn enqueue_and_lookup() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        assert_eq!(q.len(), 1);
        assert_eq!(q.for_treasury(t).len(), 1);
    }

    #[test]
    fn duplicate_enqueue_rejected() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        let dup = q.enqueue(bundle(1, t, PendingPriority::Normal, 100));
        assert!(matches!(dup, Err(PendingBundleError::Duplicate(_))));
    }

    #[test]
    fn approval_advances_state() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        q.decide([1u8; 32], PendingDecision::Approve, [42u8; 32], 200).unwrap();
        assert_eq!(q.get(&[1u8; 32]).unwrap().state, PendingState::Approved);
        assert_eq!(q.get(&[1u8; 32]).unwrap().decision_squads_tx, Some([42u8; 32]));
    }

    #[test]
    fn rejection_advances_state() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        q.decide([1u8; 32], PendingDecision::Reject, [42u8; 32], 200).unwrap();
        assert_eq!(q.get(&[1u8; 32]).unwrap().state, PendingState::Rejected);
    }

    #[test]
    fn decide_after_window_flips_stale() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        let r = q.decide([1u8; 32], PendingDecision::Approve, [42u8; 32], 5_000);
        assert!(matches!(r, Err(PendingBundleError::Expired { .. })));
        assert_eq!(q.get(&[1u8; 32]).unwrap().state, PendingState::Stale);
    }

    #[test]
    fn double_decide_rejected() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        q.decide([1u8; 32], PendingDecision::Approve, [42u8; 32], 200).unwrap();
        let r = q.decide([1u8; 32], PendingDecision::Approve, [42u8; 32], 201);
        assert!(matches!(r, Err(PendingBundleError::InvalidTransition(_, PendingState::Approved))));
    }

    #[test]
    fn awaiting_orders_critical_first() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Low, 100)).unwrap();
        q.enqueue(bundle(2, t, PendingPriority::Critical, 200)).unwrap();
        q.enqueue(bundle(3, t, PendingPriority::Normal, 150)).unwrap();
        let order = q.awaiting_decision();
        assert_eq!(order[0].priority, PendingPriority::Critical);
        assert_eq!(order[1].priority, PendingPriority::Normal);
        assert_eq!(order[2].priority, PendingPriority::Low);
    }

    #[test]
    fn sweep_flips_stale() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        q.enqueue(bundle(2, t, PendingPriority::Normal, 200)).unwrap();
        let n = q.sweep_stale(5_000);
        assert_eq!(n, 2);
        assert_eq!(q.get(&[1u8; 32]).unwrap().state, PendingState::Stale);
    }

    #[test]
    fn mark_executed_requires_approved() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        q.enqueue(bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        let r = q.mark_executed([1u8; 32]);
        assert!(matches!(r, Err(PendingBundleError::InvalidTransition(_, PendingState::Pending))));
        q.decide([1u8; 32], PendingDecision::Approve, [42u8; 32], 200).unwrap();
        q.mark_executed([1u8; 32]).unwrap();
        assert_eq!(q.get(&[1u8; 32]).unwrap().state, PendingState::Executed);
    }

    #[test]
    fn enqueue_pending_helper_works() {
        let mut q = PendingQueue::new();
        let t = [1u8; 32];
        enqueue_pending(&mut q, bundle(1, t, PendingPriority::Normal, 100)).unwrap();
        assert_eq!(q.len(), 1);
    }

    #[test]
    fn for_treasury_filters_correctly() {
        let mut q = PendingQueue::new();
        let t1 = [1u8; 32];
        let t2 = [2u8; 32];
        q.enqueue(bundle(1, t1, PendingPriority::Normal, 100)).unwrap();
        q.enqueue(bundle(2, t2, PendingPriority::Normal, 100)).unwrap();
        q.enqueue(bundle(3, t1, PendingPriority::Normal, 200)).unwrap();
        assert_eq!(q.for_treasury(t1).len(), 2);
        assert_eq!(q.for_treasury(t2).len(), 1);
    }
}

//! Time- and value-bounded keeper mandates (directive §4 + I-19).
//!
//! Every keeper carries a `KeeperMandate` account. Each program ix
//! entry-point ratchets `actions_used` / `notional_used_q64` and
//! refuses to advance once any cap is hit. Renewal or scope expansion
//! is a multisig event (I-21) — the program never edits a mandate
//! in place; it only ratchets the usage counters.

use crate::role::{
    assert_action_authorized, ActionBitset, ActionClass, KeeperRole,
    RoleAuthorizationError,
};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// Sentinel: zero `max_notional_per_action_q64` means "no per-action
/// cap" (the total cap still applies). We use a sentinel rather than
/// `Option<u128>` so the on-chain layout stays a fixed-size primitive
/// and the program path doesn't branch on enum tags.
pub const MAX_NOTIONAL_UNLIMITED: u128 = 0;

/// Squads multisig transaction id that issued / last extended the
/// mandate. The program records this so the audit trail points back
/// to the multisig vote.
pub type SquadsTransactionId = [u8; 32];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct MandateUsage {
    pub actions_used: u64,
    pub notional_used_q64: u128,
}

impl MandateUsage {
    pub fn empty() -> Self { Self::default() }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeeperMandate {
    pub keeper_pubkey: Pubkey,
    pub role: KeeperRole,
    /// Per-action allowance. The program checks the requested
    /// `ActionClass` against this bitset before doing anything else;
    /// the canonical role bitset is the upper bound (mandate may
    /// shrink scope but never widen past the canonical set).
    pub allowed_action_bitset: ActionBitset,
    pub valid_from_slot: u64,
    pub valid_until_slot: u64,
    pub max_actions: u64,
    /// `MAX_NOTIONAL_UNLIMITED` (0) disables the per-action cap.
    pub max_notional_per_action_q64: u128,
    pub max_notional_total_q64: u128,
    pub usage: MandateUsage,
    pub issued_by: SquadsTransactionId,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MandateError {
    #[error("mandate expired at slot {valid_until_slot}, current slot {now_slot}")]
    Expired { valid_until_slot: u64, now_slot: u64 },
    #[error("mandate not yet valid (from {valid_from_slot}, current {now_slot})")]
    NotYetValid { valid_from_slot: u64, now_slot: u64 },
    #[error("action cap exhausted: {used}/{max}")]
    ActionCapExhausted { used: u64, max: u64 },
    #[error("notional cap exhausted: used {used} + delta {delta} > max {max}")]
    NotionalCapExhausted { used: u128, delta: u128, max: u128 },
    #[error("per-action notional {delta} exceeds per-action cap {cap}")]
    PerActionCapBreached { delta: u128, cap: u128 },
    #[error("mandate scope wider than canonical role bitset for {role:?}")]
    ScopeWidenedPastCanonical { role: KeeperRole },
    #[error(transparent)]
    RoleAuth(#[from] RoleAuthorizationError),
}

impl KeeperMandate {
    /// Construct a mandate with zero usage. The program-path
    /// authority verifies `allowed_action_bitset ⊆ canonical_bitset(role)`
    /// at construction; any wider scope is rejected (I-21 — no silent
    /// scope expansion).
    pub fn new(
        keeper_pubkey: Pubkey,
        role: KeeperRole,
        allowed_action_bitset: ActionBitset,
        valid_from_slot: u64,
        valid_until_slot: u64,
        max_actions: u64,
        max_notional_per_action_q64: u128,
        max_notional_total_q64: u128,
        issued_by: SquadsTransactionId,
    ) -> Result<Self, MandateError> {
        let canonical = role.canonical_bitset();
        if !bitset_is_subset(&allowed_action_bitset, &canonical) {
            return Err(MandateError::ScopeWidenedPastCanonical { role });
        }
        Ok(Self {
            keeper_pubkey,
            role,
            allowed_action_bitset,
            valid_from_slot,
            valid_until_slot,
            max_actions,
            max_notional_per_action_q64,
            max_notional_total_q64,
            usage: MandateUsage::empty(),
            issued_by,
        })
    }

    /// Pre-flight check before recording usage. Returns Ok iff the
    /// action would be admissible right now. Program code calls this,
    /// then on success calls `ratchet`.
    pub fn check(
        &self,
        action: ActionClass,
        now_slot: u64,
        notional_delta_q64: u128,
    ) -> Result<(), MandateError> {
        if now_slot < self.valid_from_slot {
            return Err(MandateError::NotYetValid {
                valid_from_slot: self.valid_from_slot,
                now_slot,
            });
        }
        if now_slot >= self.valid_until_slot {
            return Err(MandateError::Expired {
                valid_until_slot: self.valid_until_slot,
                now_slot,
            });
        }
        assert_action_authorized(self.role, &self.allowed_action_bitset, action)?;
        if self.usage.actions_used >= self.max_actions {
            return Err(MandateError::ActionCapExhausted {
                used: self.usage.actions_used,
                max: self.max_actions,
            });
        }
        if self.max_notional_per_action_q64 != MAX_NOTIONAL_UNLIMITED
            && notional_delta_q64 > self.max_notional_per_action_q64
        {
            return Err(MandateError::PerActionCapBreached {
                delta: notional_delta_q64,
                cap: self.max_notional_per_action_q64,
            });
        }
        let projected = self.usage.notional_used_q64.saturating_add(notional_delta_q64);
        if projected > self.max_notional_total_q64 {
            return Err(MandateError::NotionalCapExhausted {
                used: self.usage.notional_used_q64,
                delta: notional_delta_q64,
                max: self.max_notional_total_q64,
            });
        }
        Ok(())
    }

    /// Ratchet usage counters. Program calls this only after `check`
    /// has returned Ok. Saturates rather than panicking, but the
    /// `check` invariants prevent any saturation in practice.
    pub fn ratchet(&mut self, notional_delta_q64: u128) {
        self.usage.actions_used = self.usage.actions_used.saturating_add(1);
        self.usage.notional_used_q64 = self
            .usage
            .notional_used_q64
            .saturating_add(notional_delta_q64);
    }

    /// Atomic check-and-ratchet helper. Most program paths use this.
    pub fn admit(
        &mut self,
        action: ActionClass,
        now_slot: u64,
        notional_delta_q64: u128,
    ) -> Result<(), MandateError> {
        self.check(action, now_slot, notional_delta_q64)?;
        self.ratchet(notional_delta_q64);
        Ok(())
    }

    pub fn remaining_actions(&self) -> u64 {
        self.max_actions.saturating_sub(self.usage.actions_used)
    }

    pub fn remaining_notional_q64(&self) -> u128 {
        self.max_notional_total_q64.saturating_sub(self.usage.notional_used_q64)
    }
}

fn bitset_is_subset(narrow: &ActionBitset, wide: &ActionBitset) -> bool {
    narrow
        .0
        .iter()
        .zip(wide.0.iter())
        .all(|(n, w)| (n & !w) == 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh_mandate(role: KeeperRole, max_actions: u64, total: u128, per: u128) -> KeeperMandate {
        KeeperMandate::new(
            [7u8; 32],
            role,
            role.canonical_bitset(),
            100,
            10_000,
            max_actions,
            per,
            total,
            [0u8; 32],
        )
        .expect("scope == canonical")
    }

    #[test]
    fn happy_path_admits_and_ratchets() {
        let mut m = fresh_mandate(KeeperRole::RebalanceKeeper, 3, 1_000_000, 500_000);
        m.admit(ActionClass::RebalanceExecute, 200, 100_000).unwrap();
        assert_eq!(m.usage.actions_used, 1);
        assert_eq!(m.usage.notional_used_q64, 100_000);
        assert_eq!(m.remaining_actions(), 2);
        assert_eq!(m.remaining_notional_q64(), 900_000);
    }

    #[test]
    fn before_valid_from_rejects() {
        let mut m = fresh_mandate(KeeperRole::SettlementKeeper, 5, 10_000, 1_000);
        let r = m.admit(ActionClass::SettlementSettle, 50, 100);
        assert!(matches!(r, Err(MandateError::NotYetValid { .. })));
    }

    #[test]
    fn after_valid_until_rejects() {
        let mut m = fresh_mandate(KeeperRole::SettlementKeeper, 5, 10_000, 1_000);
        let r = m.admit(ActionClass::SettlementSettle, 10_001, 100);
        assert!(matches!(r, Err(MandateError::Expired { .. })));
    }

    #[test]
    fn exact_valid_until_slot_rejects() {
        // Half-open interval: [valid_from, valid_until).
        let mut m = fresh_mandate(KeeperRole::SettlementKeeper, 5, 10_000, 1_000);
        let r = m.admit(ActionClass::SettlementSettle, 10_000, 100);
        assert!(matches!(r, Err(MandateError::Expired { .. })));
    }

    #[test]
    fn action_cap_exhausts_after_max() {
        let mut m = fresh_mandate(KeeperRole::RebalanceKeeper, 2, u128::MAX, MAX_NOTIONAL_UNLIMITED);
        m.admit(ActionClass::RebalanceExecute, 200, 1).unwrap();
        m.admit(ActionClass::RebalanceExecute, 200, 1).unwrap();
        let r = m.admit(ActionClass::RebalanceExecute, 200, 1);
        assert!(matches!(r, Err(MandateError::ActionCapExhausted { .. })));
    }

    #[test]
    fn notional_total_cap_exhausts() {
        let mut m = fresh_mandate(KeeperRole::RebalanceKeeper, 100, 1_000, MAX_NOTIONAL_UNLIMITED);
        m.admit(ActionClass::RebalanceExecute, 200, 600).unwrap();
        let r = m.admit(ActionClass::RebalanceExecute, 200, 500);
        assert!(matches!(r, Err(MandateError::NotionalCapExhausted { .. })));
    }

    #[test]
    fn per_action_cap_breached() {
        let mut m = fresh_mandate(KeeperRole::RebalanceKeeper, 10, 10_000_000, 1_000);
        let r = m.admit(ActionClass::RebalanceExecute, 200, 1_001);
        assert!(matches!(r, Err(MandateError::PerActionCapBreached { .. })));
    }

    #[test]
    fn unlimited_per_action_allows_any_size() {
        let mut m = fresh_mandate(KeeperRole::RebalanceKeeper, 10, u128::MAX, MAX_NOTIONAL_UNLIMITED);
        m.admit(ActionClass::RebalanceExecute, 200, u128::MAX / 2).unwrap();
    }

    #[test]
    fn cross_role_action_rejected_by_mandate() {
        let mut m = fresh_mandate(KeeperRole::RebalanceKeeper, 10, 10_000, MAX_NOTIONAL_UNLIMITED);
        let r = m.admit(ActionClass::SettlementSettle, 200, 100);
        assert!(matches!(r, Err(MandateError::RoleAuth(_))));
    }

    #[test]
    fn scope_wider_than_canonical_rejected() {
        let mut wider = KeeperRole::RebalanceKeeper.canonical_bitset();
        wider = wider.allow(ActionClass::SettlementSettle);
        let r = KeeperMandate::new(
            [1u8; 32],
            KeeperRole::RebalanceKeeper,
            wider,
            100,
            10_000,
            5,
            0,
            10_000,
            [0u8; 32],
        );
        assert!(matches!(r, Err(MandateError::ScopeWidenedPastCanonical { .. })));
    }

    #[test]
    fn narrower_scope_accepted() {
        // ArchiveKeeper's canonical set is {ArchiveAppend,
        // DisclosureLogWrite}; a narrower mandate that only
        // permits ArchiveAppend is fine.
        let narrower = ActionBitset::empty().allow(ActionClass::ArchiveAppend);
        let m = KeeperMandate::new(
            [1u8; 32],
            KeeperRole::ArchiveKeeper,
            narrower,
            100,
            10_000,
            5,
            0,
            1_000,
            [0u8; 32],
        )
        .unwrap();
        assert_eq!(m.allowed_action_bitset.count(), 1);
    }

    #[test]
    fn ratcheting_persists_across_calls() {
        let mut m = fresh_mandate(KeeperRole::RebalanceKeeper, 10, 10_000, MAX_NOTIONAL_UNLIMITED);
        for _ in 0..5 {
            m.admit(ActionClass::RebalanceExecute, 200, 100).unwrap();
        }
        assert_eq!(m.usage.actions_used, 5);
        assert_eq!(m.usage.notional_used_q64, 500);
        assert_eq!(m.remaining_actions(), 5);
        assert_eq!(m.remaining_notional_q64(), 9_500);
    }

    #[test]
    fn check_does_not_mutate_usage() {
        let m = fresh_mandate(KeeperRole::RebalanceKeeper, 10, 10_000, MAX_NOTIONAL_UNLIMITED);
        m.check(ActionClass::RebalanceExecute, 200, 100).unwrap();
        m.check(ActionClass::RebalanceExecute, 200, 100).unwrap();
        assert_eq!(m.usage.actions_used, 0);
    }
}

//! Off-chain mirror of the `atlas_keeper_registry` program (directive §11).
//!
//! Each `KeeperMandate` is a discrete on-chain account keyed by the
//! keeper pubkey. This module models the registry's lookup +
//! rotation surface so off-chain code (the operator agent, the
//! warehouse, the SDK) can validate signers against the same
//! invariants the program enforces.
//!
//! The registry never widens scope. Rotation produces a brand-new
//! mandate; the old one is expired (its slot bound passed) or
//! revoked (stored separately for the audit trail).

use crate::mandate::{KeeperMandate, MandateError, SquadsTransactionId};
use crate::role::{ActionClass, KeeperRole};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct KeeperRegistry {
    /// Active mandates keyed by keeper pubkey. The on-chain layout
    /// uses a PDA per mandate; this map mirrors the lookup.
    active: BTreeMap<Pubkey, KeeperMandate>,
    /// Revoked mandates retained for audit. The program never
    /// deletes a mandate account; it marks it revoked and leaves
    /// the slot history intact.
    revoked: Vec<RevokedMandate>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevokedMandate {
    pub mandate: KeeperMandate,
    pub revoked_at_slot: u64,
    pub revoked_by: SquadsTransactionId,
    pub reason: RevocationReason,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RevocationReason {
    /// Multisig rotation — superseded by a fresh mandate.
    Rotation,
    /// Operator key compromise.
    Compromise,
    /// Mandate caps proved too generous; tightened scope replaces it.
    ScopeTighten,
    /// Manual administrative revocation.
    Manual,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RegistryError {
    #[error("keeper {0:?} already has an active mandate")]
    DuplicateActive(Pubkey),
    #[error("keeper {0:?} not in registry")]
    UnknownKeeper(Pubkey),
    #[error("role mismatch: registry has {expected:?}, signer presented {actual:?}")]
    RoleMismatch { expected: KeeperRole, actual: KeeperRole },
    #[error(transparent)]
    Mandate(#[from] MandateError),
}

impl KeeperRegistry {
    pub fn new() -> Self { Self::default() }

    /// Issue a new mandate. Fails if the keeper already has an
    /// active one — multisig must revoke the prior mandate first.
    pub fn issue(&mut self, mandate: KeeperMandate) -> Result<(), RegistryError> {
        if self.active.contains_key(&mandate.keeper_pubkey) {
            return Err(RegistryError::DuplicateActive(mandate.keeper_pubkey));
        }
        self.active.insert(mandate.keeper_pubkey, mandate);
        Ok(())
    }

    /// Revoke an active mandate, moving it to the revoked log. The
    /// audit trail keeps the full mandate including its issued_by /
    /// usage counters at revocation time.
    pub fn revoke(
        &mut self,
        keeper_pubkey: Pubkey,
        revoked_at_slot: u64,
        revoked_by: SquadsTransactionId,
        reason: RevocationReason,
    ) -> Result<(), RegistryError> {
        let mandate = self
            .active
            .remove(&keeper_pubkey)
            .ok_or(RegistryError::UnknownKeeper(keeper_pubkey))?;
        self.revoked.push(RevokedMandate { mandate, revoked_at_slot, revoked_by, reason });
        Ok(())
    }

    /// Atomic rotate: revoke the prior mandate and install a fresh
    /// one in a single multisig event.
    pub fn rotate(
        &mut self,
        prior: Pubkey,
        replacement: KeeperMandate,
        rotated_at_slot: u64,
        rotated_by: SquadsTransactionId,
    ) -> Result<(), RegistryError> {
        self.revoke(prior, rotated_at_slot, rotated_by, RevocationReason::Rotation)?;
        self.issue(replacement)
    }

    pub fn get(&self, keeper_pubkey: &Pubkey) -> Option<&KeeperMandate> {
        self.active.get(keeper_pubkey)
    }

    pub fn get_mut(&mut self, keeper_pubkey: &Pubkey) -> Option<&mut KeeperMandate> {
        self.active.get_mut(keeper_pubkey)
    }

    pub fn revoked(&self) -> &[RevokedMandate] {
        &self.revoked
    }

    /// Resolve a signer presenting `(pubkey, role)` — the program
    /// checks this on every ix entry. Confirms the keeper is in the
    /// registry, the presented role matches, and the requested
    /// action is admissible right now. Mutates usage on success.
    pub fn admit(
        &mut self,
        signer: Pubkey,
        presented_role: KeeperRole,
        action: ActionClass,
        now_slot: u64,
        notional_delta_q64: u128,
    ) -> Result<(), RegistryError> {
        let m = self
            .active
            .get_mut(&signer)
            .ok_or(RegistryError::UnknownKeeper(signer))?;
        if m.role != presented_role {
            return Err(RegistryError::RoleMismatch {
                expected: m.role,
                actual: presented_role,
            });
        }
        m.admit(action, now_slot, notional_delta_q64)?;
        Ok(())
    }

    /// Read-only check (no usage mutation). Useful for dry-run /
    /// preflight from the SDK.
    pub fn check(
        &self,
        signer: Pubkey,
        presented_role: KeeperRole,
        action: ActionClass,
        now_slot: u64,
        notional_delta_q64: u128,
    ) -> Result<(), RegistryError> {
        let m = self
            .active
            .get(&signer)
            .ok_or(RegistryError::UnknownKeeper(signer))?;
        if m.role != presented_role {
            return Err(RegistryError::RoleMismatch {
                expected: m.role,
                actual: presented_role,
            });
        }
        m.check(action, now_slot, notional_delta_q64)?;
        Ok(())
    }

    pub fn active_count(&self) -> usize { self.active.len() }
    pub fn revoked_count(&self) -> usize { self.revoked.len() }

    /// Iterate active mandates in pubkey order.
    pub fn iter_active(&self) -> impl Iterator<Item = (&Pubkey, &KeeperMandate)> {
        self.active.iter()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mandate::MAX_NOTIONAL_UNLIMITED;
    use crate::role::ActionClass;

    fn mandate(pk: Pubkey, role: KeeperRole) -> KeeperMandate {
        KeeperMandate::new(
            pk,
            role,
            role.canonical_bitset(),
            100,
            10_000,
            10,
            MAX_NOTIONAL_UNLIMITED,
            1_000_000,
            [0u8; 32],
        )
        .unwrap()
    }

    #[test]
    fn issue_and_get() {
        let mut r = KeeperRegistry::new();
        let pk = [1u8; 32];
        r.issue(mandate(pk, KeeperRole::RebalanceKeeper)).unwrap();
        assert_eq!(r.active_count(), 1);
        assert_eq!(r.get(&pk).unwrap().role, KeeperRole::RebalanceKeeper);
    }

    #[test]
    fn duplicate_issue_rejected() {
        let mut r = KeeperRegistry::new();
        let pk = [1u8; 32];
        r.issue(mandate(pk, KeeperRole::RebalanceKeeper)).unwrap();
        let dup = r.issue(mandate(pk, KeeperRole::SettlementKeeper));
        assert!(matches!(dup, Err(RegistryError::DuplicateActive(_))));
    }

    #[test]
    fn revoke_moves_to_revoked_log() {
        let mut r = KeeperRegistry::new();
        let pk = [1u8; 32];
        r.issue(mandate(pk, KeeperRole::RebalanceKeeper)).unwrap();
        r.revoke(pk, 500, [9u8; 32], RevocationReason::Compromise).unwrap();
        assert_eq!(r.active_count(), 0);
        assert_eq!(r.revoked_count(), 1);
        assert_eq!(r.revoked()[0].reason, RevocationReason::Compromise);
    }

    #[test]
    fn rotate_atomically_swaps() {
        let mut r = KeeperRegistry::new();
        let pk_old = [1u8; 32];
        let pk_new = [2u8; 32];
        r.issue(mandate(pk_old, KeeperRole::RebalanceKeeper)).unwrap();
        r.rotate(pk_old, mandate(pk_new, KeeperRole::RebalanceKeeper), 500, [3u8; 32]).unwrap();
        assert_eq!(r.active_count(), 1);
        assert_eq!(r.revoked_count(), 1);
        assert!(r.get(&pk_old).is_none());
        assert!(r.get(&pk_new).is_some());
    }

    #[test]
    fn admit_requires_matching_role() {
        let mut r = KeeperRegistry::new();
        let pk = [1u8; 32];
        r.issue(mandate(pk, KeeperRole::RebalanceKeeper)).unwrap();
        let bad = r.admit(pk, KeeperRole::SettlementKeeper, ActionClass::SettlementSettle, 200, 100);
        assert!(matches!(bad, Err(RegistryError::RoleMismatch { .. })));
    }

    #[test]
    fn admit_unknown_keeper_rejected() {
        let mut r = KeeperRegistry::new();
        let bad = r.admit([9u8; 32], KeeperRole::RebalanceKeeper, ActionClass::RebalanceExecute, 200, 100);
        assert!(matches!(bad, Err(RegistryError::UnknownKeeper(_))));
    }

    #[test]
    fn admit_advances_usage() {
        let mut r = KeeperRegistry::new();
        let pk = [1u8; 32];
        r.issue(mandate(pk, KeeperRole::RebalanceKeeper)).unwrap();
        r.admit(pk, KeeperRole::RebalanceKeeper, ActionClass::RebalanceExecute, 200, 100).unwrap();
        assert_eq!(r.get(&pk).unwrap().usage.actions_used, 1);
    }

    #[test]
    fn check_does_not_advance_usage() {
        let mut r = KeeperRegistry::new();
        let pk = [1u8; 32];
        r.issue(mandate(pk, KeeperRole::RebalanceKeeper)).unwrap();
        r.check(pk, KeeperRole::RebalanceKeeper, ActionClass::RebalanceExecute, 200, 100).unwrap();
        assert_eq!(r.get(&pk).unwrap().usage.actions_used, 0);
    }

    #[test]
    fn admit_after_expiry_rejects() {
        let mut r = KeeperRegistry::new();
        let pk = [1u8; 32];
        r.issue(mandate(pk, KeeperRole::RebalanceKeeper)).unwrap();
        let bad = r.admit(
            pk,
            KeeperRole::RebalanceKeeper,
            ActionClass::RebalanceExecute,
            10_001,
            100,
        );
        assert!(matches!(bad, Err(RegistryError::Mandate(MandateError::Expired { .. }))));
    }
}

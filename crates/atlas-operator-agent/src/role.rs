//! Keeper roles + per-action bitset (directive §2 + I-18).

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KeeperRole {
    RebalanceKeeper,
    SettlementKeeper,
    AltKeeper,
    ArchiveKeeper,
    HedgeKeeper,
    PythPostKeeper,
    AttestationKeeper,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionClass {
    /// `atlas_rebalancer::execute`
    RebalanceExecute,
    /// `dodo_route::settle` / `cross_stable_router::execute`
    SettlementSettle,
    /// `alt_keeper::create / extend / deactivate`
    AltMutate,
    /// Bubblegum tree append (rebalance receipts, payment receipts,
    /// disclosure logs).
    ArchiveAppend,
    /// `atlas_hedge::open / resize / close`
    HedgeOpenCloseResize,
    /// `pyth_receiver::post_update`
    PythPost,
    /// Sign `AtlasConditionAttestation` + `ExecutionAttestation`.
    AttestationSign,
    /// Disclosure log writes (Phase 14 I-17).
    DisclosureLogWrite,
}

/// Bit position for an `ActionClass` in the keeper's allowed-action
/// bitset. Each role's allowed positions form its mandate scope.
pub const fn action_bit(action: ActionClass) -> u32 {
    match action {
        ActionClass::RebalanceExecute => 0,
        ActionClass::SettlementSettle => 1,
        ActionClass::AltMutate => 2,
        ActionClass::ArchiveAppend => 3,
        ActionClass::HedgeOpenCloseResize => 4,
        ActionClass::PythPost => 5,
        ActionClass::AttestationSign => 6,
        ActionClass::DisclosureLogWrite => 7,
    }
}

/// 64-byte bitset (matching the on-chain layout). 8 bytes are enough
/// for the current 8 actions; the extra room reserves space for
/// future action classes without a layout migration.
///
/// Serde derive does not support `[u8; 64]` natively, so we provide
/// a hand-rolled impl that ships the bytes as a length-tagged byte
/// sequence (matches the on-chain layout when read back as raw 64
/// bytes).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ActionBitset(pub [u8; 64]);

impl Default for ActionBitset {
    fn default() -> Self { Self([0u8; 64]) }
}

impl Serialize for ActionBitset {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        serde::Serialize::serialize(&self.0[..], s)
    }
}

impl<'de> Deserialize<'de> for ActionBitset {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let v: Vec<u8> = serde::Deserialize::deserialize(d)?;
        if v.len() != 64 {
            return Err(serde::de::Error::invalid_length(
                v.len(),
                &"64-byte ActionBitset",
            ));
        }
        let mut out = [0u8; 64];
        out.copy_from_slice(&v);
        Ok(Self(out))
    }
}

impl ActionBitset {
    pub fn empty() -> Self { Self::default() }

    pub fn allow(mut self, action: ActionClass) -> Self {
        let bit = action_bit(action);
        let byte = (bit / 8) as usize;
        let mask = 1u8 << (bit % 8);
        self.0[byte] |= mask;
        self
    }

    pub fn permits(&self, action: ActionClass) -> bool {
        let bit = action_bit(action);
        let byte = (bit / 8) as usize;
        let mask = 1u8 << (bit % 8);
        (self.0[byte] & mask) != 0
    }

    /// Number of allowed action bits set. Production keeper roles
    /// hold tightly-scoped bitsets (the rebalance keeper's count
    /// should be 1, the attestation keeper's count should be 1, etc).
    pub fn count(&self) -> u32 {
        self.0.iter().map(|b| b.count_ones()).sum()
    }
}

impl KeeperRole {
    /// Canonical bitset per directive §2 (programs verify against
    /// this exact set per-ix).
    pub fn canonical_bitset(self) -> ActionBitset {
        let bits = ActionBitset::empty();
        match self {
            KeeperRole::RebalanceKeeper => bits.allow(ActionClass::RebalanceExecute),
            KeeperRole::SettlementKeeper => bits.allow(ActionClass::SettlementSettle),
            KeeperRole::AltKeeper => bits.allow(ActionClass::AltMutate),
            KeeperRole::ArchiveKeeper => {
                bits.allow(ActionClass::ArchiveAppend).allow(ActionClass::DisclosureLogWrite)
            }
            KeeperRole::HedgeKeeper => bits.allow(ActionClass::HedgeOpenCloseResize),
            KeeperRole::PythPostKeeper => bits.allow(ActionClass::PythPost),
            KeeperRole::AttestationKeeper => bits.allow(ActionClass::AttestationSign),
        }
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RoleAuthorizationError {
    #[error("role {role:?} not authorised for action {action:?}")]
    ActionNotPermitted { role: KeeperRole, action: ActionClass },
}

/// Cross-role rejection (I-18 enforcement). Every program ix entry
/// invokes this against the signer's role.
pub fn assert_action_authorized(
    role: KeeperRole,
    bitset: &ActionBitset,
    action: ActionClass,
) -> Result<(), RoleAuthorizationError> {
    if !bitset.permits(action) {
        return Err(RoleAuthorizationError::ActionNotPermitted { role, action });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rebalance_keeper_only_permits_rebalance() {
        let b = KeeperRole::RebalanceKeeper.canonical_bitset();
        assert!(b.permits(ActionClass::RebalanceExecute));
        assert!(!b.permits(ActionClass::SettlementSettle));
        assert!(!b.permits(ActionClass::HedgeOpenCloseResize));
        assert!(!b.permits(ActionClass::AltMutate));
        assert_eq!(b.count(), 1);
    }

    #[test]
    fn settlement_keeper_cannot_rebalance() {
        let b = KeeperRole::SettlementKeeper.canonical_bitset();
        assert!(b.permits(ActionClass::SettlementSettle));
        assert!(!b.permits(ActionClass::RebalanceExecute));
        assert!(!b.permits(ActionClass::HedgeOpenCloseResize));
    }

    #[test]
    fn archive_keeper_carries_two_actions() {
        let b = KeeperRole::ArchiveKeeper.canonical_bitset();
        assert!(b.permits(ActionClass::ArchiveAppend));
        assert!(b.permits(ActionClass::DisclosureLogWrite));
        assert_eq!(b.count(), 2);
    }

    #[test]
    fn attestation_keeper_cannot_mutate_state() {
        let b = KeeperRole::AttestationKeeper.canonical_bitset();
        assert!(b.permits(ActionClass::AttestationSign));
        assert!(!b.permits(ActionClass::RebalanceExecute));
        assert!(!b.permits(ActionClass::SettlementSettle));
        assert!(!b.permits(ActionClass::HedgeOpenCloseResize));
        assert!(!b.permits(ActionClass::ArchiveAppend));
    }

    #[test]
    fn cross_role_signing_rejected() {
        let bitset = KeeperRole::RebalanceKeeper.canonical_bitset();
        let r = assert_action_authorized(
            KeeperRole::RebalanceKeeper,
            &bitset,
            ActionClass::SettlementSettle,
        );
        assert!(matches!(r, Err(RoleAuthorizationError::ActionNotPermitted { .. })));
    }

    #[test]
    fn permitted_action_passes_authorization() {
        let bitset = KeeperRole::SettlementKeeper.canonical_bitset();
        assert_action_authorized(
            KeeperRole::SettlementKeeper,
            &bitset,
            ActionClass::SettlementSettle,
        )
        .unwrap();
    }
}

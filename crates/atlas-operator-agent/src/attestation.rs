//! Independent execution-time attestations (directive §3 + I-20).
//!
//! High-impact actions require BOTH the proof gate (atlas-verifier
//! over the SP1 receipt) AND a separate `ExecutionAttestation`
//! produced by the attestation keeper. The attestation keeper runs
//! out-of-band — different binary, different RPC quorum, different
//! key — so a single compromised process cannot produce a bundle
//! that the program will accept.
//!
//! `MAX_ATTESTATION_STALENESS_SLOTS` is the on-chain freshness gate:
//! the program rejects attestations whose `slot` is more than this
//! many slots behind the current tip.

use crate::role::KeeperRole;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// On-chain freshness window for execution attestations. The
/// program rejects any attestation whose `slot` lags the current
/// slot by more than this many slots. 16 ≈ 6.4s on Solana mainnet —
/// short enough that an attacker can't replay a stale attestation,
/// long enough that the attestation keeper's RPC variance + signing
/// latency fits comfortably.
pub const MAX_ATTESTATION_STALENESS_SLOTS: u64 = 16;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttestationKind {
    RebalanceExecuted,
    SettlementSettled,
    HedgeOpenedResizedClosed,
    AltMutated,
    PythPosted,
    ArchiveAppended,
}

impl AttestationKind {
    /// Maps an attestation kind back to the keeper role that would
    /// have produced the underlying action. Used by the program to
    /// pair the attestation with the actor it covers.
    pub fn covering_role(self) -> KeeperRole {
        match self {
            AttestationKind::RebalanceExecuted => KeeperRole::RebalanceKeeper,
            AttestationKind::SettlementSettled => KeeperRole::SettlementKeeper,
            AttestationKind::HedgeOpenedResizedClosed => KeeperRole::HedgeKeeper,
            AttestationKind::AltMutated => KeeperRole::AltKeeper,
            AttestationKind::PythPosted => KeeperRole::PythPostKeeper,
            AttestationKind::ArchiveAppended => KeeperRole::ArchiveKeeper,
        }
    }
}

/// Independent attestation written by the attestation keeper. The
/// `payload_hash` binds to the action's effect (post-state hash for
/// rebalance, settled-amount + dest hash for settlement, etc.) so
/// the on-chain verifier can match the attestation to the bundle
/// without re-deriving the side-effect itself.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutionAttestation {
    pub kind: AttestationKind,
    /// Pubkey of the attestation keeper signer (must hold the
    /// AttestationKeeper role).
    pub attestation_keeper: Pubkey,
    /// Pubkey of the keeper that produced the underlying action
    /// (rebalance / settlement / etc.). Distinct from
    /// `attestation_keeper` per I-20.
    pub action_keeper: Pubkey,
    /// blake3 over the action's effect. See `payload_digest`.
    pub payload_hash: [u8; 32],
    /// Independent RPC quorum hash — blake3 over the slot/leader
    /// observed by the attestation keeper's quorum at signing time.
    /// Differing observed-state from the rebalance keeper's RPC is
    /// the canonical detection signal.
    pub oracle_quorum_hash: [u8; 32],
    /// Slot at which the attestation keeper signed.
    pub slot: u64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AttestationError {
    #[error("attestation stale: signed at slot {signed_at}, current {now}, max staleness {max}")]
    Stale { signed_at: u64, now: u64, max: u64 },
    #[error("attestation slot {signed_at} ahead of current slot {now}")]
    FutureSlot { signed_at: u64, now: u64 },
    #[error(
        "attestation keeper {attestation_keeper:?} matches action keeper {action_keeper:?} \
         — I-20 requires distinct signers"
    )]
    SameSigner { attestation_keeper: Pubkey, action_keeper: Pubkey },
    #[error(
        "presented attestation kind {kind:?} expects role {expected:?}, action keeper holds {actual:?}"
    )]
    KindRoleMismatch { kind: AttestationKind, expected: KeeperRole, actual: KeeperRole },
    #[error("payload_hash mismatch: attestation has {attestation:?}, action effect is {action:?}")]
    PayloadMismatch { attestation: [u8; 32], action: [u8; 32] },
}

/// Domain-tagged blake3 over a payload buffer. Using the same
/// domain tag both sides (action emit + attestation sign) ensures
/// the program can compare the attestation's `payload_hash` against
/// the bundle's recorded effect deterministically.
pub fn payload_digest(domain: &str, payload: &[u8]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.attestation.v1.");
    h.update(domain.as_bytes());
    h.update(b".");
    h.update(payload);
    *h.finalize().as_bytes()
}

/// Verify the freshness window. The on-chain program calls this
/// against the live `Clock::slot`; the off-chain SDK calls it
/// against the keeper's observed slot for preflight.
pub fn attest_freshness(
    attestation: &ExecutionAttestation,
    now_slot: u64,
) -> Result<(), AttestationError> {
    if attestation.slot > now_slot {
        return Err(AttestationError::FutureSlot {
            signed_at: attestation.slot,
            now: now_slot,
        });
    }
    let lag = now_slot.saturating_sub(attestation.slot);
    if lag > MAX_ATTESTATION_STALENESS_SLOTS {
        return Err(AttestationError::Stale {
            signed_at: attestation.slot,
            now: now_slot,
            max: MAX_ATTESTATION_STALENESS_SLOTS,
        });
    }
    Ok(())
}

/// Full attestation verification. Bundles freshness + signer
/// independence + role matching + payload-hash equality.
///
/// `actual_action_role` is what the registry says the action signer
/// holds; `recorded_action_effect` is the blake3 the program
/// already has from the action ix (for rebalance: the post-state
/// hash). Returns Ok only if everything lines up.
pub fn verify_execution_attestation(
    attestation: &ExecutionAttestation,
    actual_action_role: KeeperRole,
    recorded_action_effect: [u8; 32],
    now_slot: u64,
) -> Result<(), AttestationError> {
    attest_freshness(attestation, now_slot)?;
    if attestation.attestation_keeper == attestation.action_keeper {
        return Err(AttestationError::SameSigner {
            attestation_keeper: attestation.attestation_keeper,
            action_keeper: attestation.action_keeper,
        });
    }
    let expected = attestation.kind.covering_role();
    if expected != actual_action_role {
        return Err(AttestationError::KindRoleMismatch {
            kind: attestation.kind,
            expected,
            actual: actual_action_role,
        });
    }
    if attestation.payload_hash != recorded_action_effect {
        return Err(AttestationError::PayloadMismatch {
            attestation: attestation.payload_hash,
            action: recorded_action_effect,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn att(kind: AttestationKind, slot: u64) -> ExecutionAttestation {
        ExecutionAttestation {
            kind,
            attestation_keeper: [11u8; 32],
            action_keeper: [22u8; 32],
            payload_hash: [9u8; 32],
            oracle_quorum_hash: [3u8; 32],
            slot,
        }
    }

    #[test]
    fn fresh_attestation_passes() {
        let a = att(AttestationKind::RebalanceExecuted, 1_000);
        attest_freshness(&a, 1_010).unwrap();
    }

    #[test]
    fn boundary_staleness_passes() {
        let a = att(AttestationKind::RebalanceExecuted, 1_000);
        attest_freshness(&a, 1_000 + MAX_ATTESTATION_STALENESS_SLOTS).unwrap();
    }

    #[test]
    fn just_past_staleness_rejects() {
        let a = att(AttestationKind::RebalanceExecuted, 1_000);
        let r = attest_freshness(&a, 1_000 + MAX_ATTESTATION_STALENESS_SLOTS + 1);
        assert!(matches!(r, Err(AttestationError::Stale { .. })));
    }

    #[test]
    fn future_slot_rejects() {
        let a = att(AttestationKind::RebalanceExecuted, 1_010);
        let r = attest_freshness(&a, 1_000);
        assert!(matches!(r, Err(AttestationError::FutureSlot { .. })));
    }

    #[test]
    fn same_signer_rejects() {
        let mut a = att(AttestationKind::RebalanceExecuted, 1_000);
        a.attestation_keeper = a.action_keeper;
        let r = verify_execution_attestation(&a, KeeperRole::RebalanceKeeper, [9u8; 32], 1_005);
        assert!(matches!(r, Err(AttestationError::SameSigner { .. })));
    }

    #[test]
    fn kind_role_mismatch_rejects() {
        let a = att(AttestationKind::RebalanceExecuted, 1_000);
        // Action signer presented as SettlementKeeper; attestation
        // is for a Rebalance action — programs reject this pairing.
        let r = verify_execution_attestation(&a, KeeperRole::SettlementKeeper, [9u8; 32], 1_005);
        assert!(matches!(r, Err(AttestationError::KindRoleMismatch { .. })));
    }

    #[test]
    fn payload_mismatch_rejects() {
        let a = att(AttestationKind::RebalanceExecuted, 1_000);
        let r = verify_execution_attestation(&a, KeeperRole::RebalanceKeeper, [0xaa; 32], 1_005);
        assert!(matches!(r, Err(AttestationError::PayloadMismatch { .. })));
    }

    #[test]
    fn full_verification_happy_path() {
        let a = att(AttestationKind::RebalanceExecuted, 1_000);
        verify_execution_attestation(&a, KeeperRole::RebalanceKeeper, [9u8; 32], 1_005).unwrap();
    }

    #[test]
    fn covering_role_complete() {
        for k in [
            AttestationKind::RebalanceExecuted,
            AttestationKind::SettlementSettled,
            AttestationKind::HedgeOpenedResizedClosed,
            AttestationKind::AltMutated,
            AttestationKind::PythPosted,
            AttestationKind::ArchiveAppended,
        ] {
            let _ = k.covering_role();
        }
    }

    #[test]
    fn payload_digest_domain_separated() {
        let a = payload_digest("rebalance", b"x");
        let b = payload_digest("settlement", b"x");
        assert_ne!(a, b);
    }

    #[test]
    fn payload_digest_deterministic() {
        let a = payload_digest("rebalance", b"abc");
        let b = payload_digest("rebalance", b"abc");
        assert_eq!(a, b);
    }
}

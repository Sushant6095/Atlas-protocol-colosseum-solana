//! Public input v4 (396 bytes) — private execution mode (directive §4.2).
//!
//! Extends v3 (Phase 14, confidential mode) with the three private-
//! execution fields: `er_session_id`, `er_state_root`,
//! `post_state_commitment`. Layout below; offsets pinned by tests.
//!
//! ```text
//! offset  size  name
//! 0       1     version (0x04)
//! 1       1     reserved (0x00)
//! 2       2     flags (bit2 = confidential, bit3 = private_execution)
//! 4       8     slot                       mainnet slot at session open
//! 12      32    vault_id
//! 44      32    model_hash
//! 76      32    state_commitment_root      pre-state Pedersen
//! 108     32    feature_root
//! 140     32    consensus_root
//! 172     32    allocation_ratios_root
//! 204     32    explanation_hash
//! 236     32    risk_state_hash
//! 268     32    disclosure_policy_hash
//! 300     32    er_session_id              MagicBlock session
//! 332     32    er_state_root              ER Merkle root of session execution
//! 364     32    post_state_commitment      Pedersen over post-rebalance state
//! total: 396 bytes
//! ```

use serde::{Deserialize, Serialize};

pub const V4_VERSION_TAG: u8 = 0x04;
pub const V4_TOTAL_BYTES: usize = 396;
pub const V4_FLAG_CONFIDENTIAL_MODE: u16 = 1 << 2;
pub const V4_FLAG_PRIVATE_EXECUTION: u16 = 1 << 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PrivateExecutionFlags(pub u16);

impl PrivateExecutionFlags {
    pub fn private() -> Self { Self(V4_FLAG_PRIVATE_EXECUTION) }
    pub fn confidential_and_private() -> Self {
        Self(V4_FLAG_CONFIDENTIAL_MODE | V4_FLAG_PRIVATE_EXECUTION)
    }
    pub fn is_confidential(&self) -> bool { (self.0 & V4_FLAG_CONFIDENTIAL_MODE) != 0 }
    pub fn is_private_execution(&self) -> bool { (self.0 & V4_FLAG_PRIVATE_EXECUTION) != 0 }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicInputV4 {
    pub flags: PrivateExecutionFlags,
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub model_hash: [u8; 32],
    pub state_commitment_root: [u8; 32],
    pub feature_root: [u8; 32],
    pub consensus_root: [u8; 32],
    pub allocation_ratios_root: [u8; 32],
    pub explanation_hash: [u8; 32],
    pub risk_state_hash: [u8; 32],
    pub disclosure_policy_hash: [u8; 32],
    pub er_session_id: [u8; 32],
    pub er_state_root: [u8; 32],
    pub post_state_commitment: [u8; 32],
}

pub fn encode_v4(input: &PublicInputV4) -> [u8; V4_TOTAL_BYTES] {
    let mut out = [0u8; V4_TOTAL_BYTES];
    out[0] = V4_VERSION_TAG;
    out[1] = 0x00;
    out[2..4].copy_from_slice(&input.flags.0.to_le_bytes());
    out[4..12].copy_from_slice(&input.slot.to_le_bytes());
    out[12..44].copy_from_slice(&input.vault_id);
    out[44..76].copy_from_slice(&input.model_hash);
    out[76..108].copy_from_slice(&input.state_commitment_root);
    out[108..140].copy_from_slice(&input.feature_root);
    out[140..172].copy_from_slice(&input.consensus_root);
    out[172..204].copy_from_slice(&input.allocation_ratios_root);
    out[204..236].copy_from_slice(&input.explanation_hash);
    out[236..268].copy_from_slice(&input.risk_state_hash);
    out[268..300].copy_from_slice(&input.disclosure_policy_hash);
    out[300..332].copy_from_slice(&input.er_session_id);
    out[332..364].copy_from_slice(&input.er_state_root);
    out[364..396].copy_from_slice(&input.post_state_commitment);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> PublicInputV4 {
        PublicInputV4 {
            flags: PrivateExecutionFlags::confidential_and_private(),
            slot: 1_234_567,
            vault_id: [1u8; 32],
            model_hash: [2u8; 32],
            state_commitment_root: [3u8; 32],
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            allocation_ratios_root: [6u8; 32],
            explanation_hash: [7u8; 32],
            risk_state_hash: [8u8; 32],
            disclosure_policy_hash: [9u8; 32],
            er_session_id: [0xa1; 32],
            er_state_root: [0xa2; 32],
            post_state_commitment: [0xa3; 32],
        }
    }

    #[test]
    fn encoded_length_is_396_bytes() {
        let bytes = encode_v4(&input());
        assert_eq!(bytes.len(), V4_TOTAL_BYTES);
    }

    #[test]
    fn version_byte_is_v4() {
        let bytes = encode_v4(&input());
        assert_eq!(bytes[0], V4_VERSION_TAG);
    }

    #[test]
    fn private_execution_flag_set() {
        let bytes = encode_v4(&input());
        let flags = u16::from_le_bytes([bytes[2], bytes[3]]);
        assert!((flags & V4_FLAG_PRIVATE_EXECUTION) != 0);
    }

    #[test]
    fn confidential_and_private_flags_coexist() {
        let bytes = encode_v4(&input());
        let flags = u16::from_le_bytes([bytes[2], bytes[3]]);
        assert!((flags & V4_FLAG_CONFIDENTIAL_MODE) != 0);
        assert!((flags & V4_FLAG_PRIVATE_EXECUTION) != 0);
    }

    #[test]
    fn er_session_id_at_offset_300() {
        let bytes = encode_v4(&input());
        assert_eq!(&bytes[300..332], &[0xa1; 32]);
    }

    #[test]
    fn er_state_root_at_offset_332() {
        let bytes = encode_v4(&input());
        assert_eq!(&bytes[332..364], &[0xa2; 32]);
    }

    #[test]
    fn post_state_commitment_at_offset_364() {
        let bytes = encode_v4(&input());
        assert_eq!(&bytes[364..396], &[0xa3; 32]);
    }

    #[test]
    fn disclosure_policy_hash_unchanged_from_v3_offset() {
        // Offset 268 — same position as v3 so verifier code doesn't
        // need a separate path for the disclosure-hash extraction.
        let bytes = encode_v4(&input());
        assert_eq!(&bytes[268..300], &[9u8; 32]);
    }

    #[test]
    fn slot_round_trips_at_offset_4() {
        let bytes = encode_v4(&input());
        let slot = u64::from_le_bytes([
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11],
        ]);
        assert_eq!(slot, 1_234_567);
    }

    #[test]
    fn flag_helpers_consistent() {
        let f = PrivateExecutionFlags::confidential_and_private();
        assert!(f.is_confidential());
        assert!(f.is_private_execution());
        let p = PrivateExecutionFlags::private();
        assert!(!p.is_confidential());
        assert!(p.is_private_execution());
    }
}

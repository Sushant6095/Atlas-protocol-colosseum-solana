//! Public input v3 (300 bytes) — confidential mode (directive §4).
//!
//! ```text
//! offset  size  name
//! 0       1     version (0x03)
//! 1       1     reserved (0x00)
//! 2       2     flags
//! 4       8     slot
//! 12      32    vault_id
//! 44      32    model_hash
//! 76      32    state_commitment_root
//! 108     32    feature_root (ratio-only features)
//! 140     32    consensus_root
//! 172     32    allocation_ratios_root
//! 204     32    explanation_hash (confidential schema v3)
//! 236     32    risk_state_hash
//! 268     32    disclosure_policy_hash
//! total: 300 bytes
//! ```

use serde::{Deserialize, Serialize};

pub const V3_VERSION_TAG: u8 = 0x03;
pub const V3_TOTAL_BYTES: usize = 300;
pub const V3_FLAG_CONFIDENTIAL_MODE: u16 = 1 << 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConfidentialFlags(pub u16);

impl ConfidentialFlags {
    pub fn confidential() -> Self { Self(V3_FLAG_CONFIDENTIAL_MODE) }
    pub fn is_confidential(&self) -> bool { (self.0 & V3_FLAG_CONFIDENTIAL_MODE) != 0 }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PublicInputV3 {
    pub flags: ConfidentialFlags,
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
}

/// Encode a `PublicInputV3` to the canonical 300-byte layout.
pub fn encode_v3(input: &PublicInputV3) -> [u8; V3_TOTAL_BYTES] {
    let mut out = [0u8; V3_TOTAL_BYTES];
    out[0] = V3_VERSION_TAG;
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
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> PublicInputV3 {
        PublicInputV3 {
            flags: ConfidentialFlags::confidential(),
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
        }
    }

    #[test]
    fn encoded_length_is_300_bytes() {
        let bytes = encode_v3(&input());
        assert_eq!(bytes.len(), V3_TOTAL_BYTES);
    }

    #[test]
    fn version_byte_is_v3() {
        let bytes = encode_v3(&input());
        assert_eq!(bytes[0], V3_VERSION_TAG);
    }

    #[test]
    fn confidential_flag_round_trips() {
        let bytes = encode_v3(&input());
        let flags = u16::from_le_bytes([bytes[2], bytes[3]]);
        assert!((flags & V3_FLAG_CONFIDENTIAL_MODE) != 0);
    }

    #[test]
    fn slot_round_trips_at_offset_4() {
        let bytes = encode_v3(&input());
        let slot = u64::from_le_bytes([
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11],
        ]);
        assert_eq!(slot, 1_234_567);
    }

    #[test]
    fn disclosure_policy_hash_at_offset_268() {
        let bytes = encode_v3(&input());
        assert_eq!(&bytes[268..300], &[9u8; 32]);
    }

    #[test]
    fn confidential_flag_helper_methods() {
        let flags = ConfidentialFlags::confidential();
        assert!(flags.is_confidential());
        let none = ConfidentialFlags(0);
        assert!(!none.is_confidential());
    }
}

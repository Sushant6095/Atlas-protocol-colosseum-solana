//! Atlas public-input v2 — the canonical 268-byte commitment shape that bridges
//! the off-chain pipeline, the SP1 zkVM guest, and the on-chain `atlas_verifier`.
//!
//! Invariants enforced here:
//!   - I-4 Canonical public input (only this crate parses or constructs the layout)
//!   - I-9 Single source of public-input truth (CI fails if logic is duplicated)
//!
//! Layout (268 bytes, all multi-byte ints little-endian, all Pubkeys raw 32 bytes):
//!
//! ```text
//! offset  size  field             description
//! 0       1     version           0x02
//! 1       1     reserved          0x00
//! 2       2     flags             bit0=defensive_mode, bit1=replay
//! 4       8     slot              u64 LE (proven slot)
//! 12      32    vault_id          target vault Pubkey
//! 44      32    model_hash        ensemble_root = poseidon(per_agent_model_hashes)
//! 76      32    state_root        snapshot commitment
//! 108     32    feature_root      canonical feature merkle root
//! 140     32    consensus_root    ensemble proposal commitment
//! 172     32    allocation_root   poseidon(allocation_vector_bps)
//! 204     32    explanation_hash  poseidon(canonical_explanation_json)
//! 236     32    risk_state_hash   poseidon(risk_topology_snapshot)
//! ```
//!
//! Domain-separated Poseidon tags used elsewhere in the system are versioned:
//!   `b"atlas.alloc.v2"`, `b"atlas.feat.v2"`, `b"atlas.expl.v2"`,
//!   `b"atlas.snapshot.v1"`, `b"atlas.consensus.v2"`, `b"atlas.risk.v2"`.

#![cfg_attr(not(feature = "std"), no_std)]
#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub const VERSION: u8 = 0x02;
pub const SIZE: usize = 268;

pub const FLAG_DEFENSIVE_MODE: u16 = 1 << 0;
pub const FLAG_REPLAY: u16 = 1 << 1;

const OFF_VERSION: usize = 0;
const OFF_RESERVED: usize = 1;
const OFF_FLAGS: usize = 2;
const OFF_SLOT: usize = 4;
const OFF_VAULT_ID: usize = 12;
const OFF_MODEL_HASH: usize = 44;
const OFF_STATE_ROOT: usize = 76;
const OFF_FEATURE_ROOT: usize = 108;
const OFF_CONSENSUS_ROOT: usize = 140;
const OFF_ALLOC_ROOT: usize = 172;
const OFF_EXPLANATION_HASH: usize = 204;
const OFF_RISK_STATE_HASH: usize = 236;

/// Canonical, byte-exact representation of the v2 public input.
///
/// Construction is total: any field may be set independently, but the bytes
/// can only enter `atlas_verifier` after passing every invariant check
/// declared in `validate()`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PublicInputV2 {
    pub flags: u16,
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub model_hash: [u8; 32],
    pub state_root: [u8; 32],
    pub feature_root: [u8; 32],
    pub consensus_root: [u8; 32],
    pub allocation_root: [u8; 32],
    pub explanation_hash: [u8; 32],
    pub risk_state_hash: [u8; 32],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "std", derive(thiserror::Error))]
pub enum PublicInputError {
    #[cfg_attr(feature = "std", error("public input must be exactly {SIZE} bytes, got {0}"))]
    BadLength(usize),
    #[cfg_attr(feature = "std", error("unsupported version byte 0x{0:02x} (expected 0x{VERSION:02x})"))]
    UnsupportedVersion(u8),
    #[cfg_attr(feature = "std", error("reserved byte must be 0x00, got 0x{0:02x}"))]
    NonZeroReserved(u8),
    #[cfg_attr(feature = "std", error("unknown flag bits set: 0x{0:04x}"))]
    UnknownFlags(u16),
}

impl PublicInputV2 {
    /// Encode into the canonical 268-byte representation.
    /// Pure: no allocation outside the returned array.
    #[inline]
    pub fn encode(&self) -> [u8; SIZE] {
        let mut out = [0u8; SIZE];
        out[OFF_VERSION] = VERSION;
        out[OFF_RESERVED] = 0x00;
        out[OFF_FLAGS..OFF_FLAGS + 2].copy_from_slice(&self.flags.to_le_bytes());
        out[OFF_SLOT..OFF_SLOT + 8].copy_from_slice(&self.slot.to_le_bytes());
        out[OFF_VAULT_ID..OFF_VAULT_ID + 32].copy_from_slice(&self.vault_id);
        out[OFF_MODEL_HASH..OFF_MODEL_HASH + 32].copy_from_slice(&self.model_hash);
        out[OFF_STATE_ROOT..OFF_STATE_ROOT + 32].copy_from_slice(&self.state_root);
        out[OFF_FEATURE_ROOT..OFF_FEATURE_ROOT + 32].copy_from_slice(&self.feature_root);
        out[OFF_CONSENSUS_ROOT..OFF_CONSENSUS_ROOT + 32].copy_from_slice(&self.consensus_root);
        out[OFF_ALLOC_ROOT..OFF_ALLOC_ROOT + 32].copy_from_slice(&self.allocation_root);
        out[OFF_EXPLANATION_HASH..OFF_EXPLANATION_HASH + 32].copy_from_slice(&self.explanation_hash);
        out[OFF_RISK_STATE_HASH..OFF_RISK_STATE_HASH + 32].copy_from_slice(&self.risk_state_hash);
        out
    }

    /// Decode + validate. Rejects v1, unknown flags, non-canonical reserved.
    pub fn decode(bytes: &[u8]) -> Result<Self, PublicInputError> {
        if bytes.len() != SIZE {
            return Err(PublicInputError::BadLength(bytes.len()));
        }
        let version = bytes[OFF_VERSION];
        if version != VERSION {
            return Err(PublicInputError::UnsupportedVersion(version));
        }
        if bytes[OFF_RESERVED] != 0 {
            return Err(PublicInputError::NonZeroReserved(bytes[OFF_RESERVED]));
        }

        let flags = u16::from_le_bytes(read_2(bytes, OFF_FLAGS));
        let known = FLAG_DEFENSIVE_MODE | FLAG_REPLAY;
        if flags & !known != 0 {
            return Err(PublicInputError::UnknownFlags(flags & !known));
        }

        Ok(Self {
            flags,
            slot: u64::from_le_bytes(read_8(bytes, OFF_SLOT)),
            vault_id: read_32(bytes, OFF_VAULT_ID),
            model_hash: read_32(bytes, OFF_MODEL_HASH),
            state_root: read_32(bytes, OFF_STATE_ROOT),
            feature_root: read_32(bytes, OFF_FEATURE_ROOT),
            consensus_root: read_32(bytes, OFF_CONSENSUS_ROOT),
            allocation_root: read_32(bytes, OFF_ALLOC_ROOT),
            explanation_hash: read_32(bytes, OFF_EXPLANATION_HASH),
            risk_state_hash: read_32(bytes, OFF_RISK_STATE_HASH),
        })
    }

    #[inline]
    pub fn is_defensive(&self) -> bool {
        self.flags & FLAG_DEFENSIVE_MODE != 0
    }
    #[inline]
    pub fn is_replay(&self) -> bool {
        self.flags & FLAG_REPLAY != 0
    }
}

#[inline(always)]
fn read_2(b: &[u8], off: usize) -> [u8; 2] {
    let mut o = [0u8; 2];
    o.copy_from_slice(&b[off..off + 2]);
    o
}
#[inline(always)]
fn read_8(b: &[u8], off: usize) -> [u8; 8] {
    let mut o = [0u8; 8];
    o.copy_from_slice(&b[off..off + 8]);
    o
}
#[inline(always)]
fn read_32(b: &[u8], off: usize) -> [u8; 32] {
    let mut o = [0u8; 32];
    o.copy_from_slice(&b[off..off + 32]);
    o
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> PublicInputV2 {
        PublicInputV2 {
            flags: FLAG_DEFENSIVE_MODE,
            slot: 0x0102_0304_0506_0708,
            vault_id: [1u8; 32],
            model_hash: [2u8; 32],
            state_root: [3u8; 32],
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            allocation_root: [6u8; 32],
            explanation_hash: [7u8; 32],
            risk_state_hash: [8u8; 32],
        }
    }

    #[test]
    fn roundtrip_byte_identical() {
        let p = sample();
        let bytes = p.encode();
        assert_eq!(bytes.len(), SIZE);
        let back = PublicInputV2::decode(&bytes).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn rejects_v1_proof() {
        let p = sample();
        let mut bytes = p.encode();
        bytes[OFF_VERSION] = 0x01;
        assert!(matches!(
            PublicInputV2::decode(&bytes),
            Err(PublicInputError::UnsupportedVersion(0x01))
        ));
    }

    #[test]
    fn rejects_unknown_flags() {
        let p = sample();
        let mut bytes = p.encode();
        bytes[OFF_FLAGS..OFF_FLAGS + 2].copy_from_slice(&0xFF00u16.to_le_bytes());
        assert!(matches!(
            PublicInputV2::decode(&bytes),
            Err(PublicInputError::UnknownFlags(_))
        ));
    }

    #[test]
    fn rejects_wrong_length() {
        assert!(matches!(
            PublicInputV2::decode(&[0u8; SIZE - 1]),
            Err(PublicInputError::BadLength(267))
        ));
    }

    #[test]
    fn defensive_flag_round_trip() {
        let p = PublicInputV2 { flags: FLAG_DEFENSIVE_MODE, ..sample() };
        assert!(p.is_defensive());
        assert!(!p.is_replay());
        let p2 = PublicInputV2::decode(&p.encode()).unwrap();
        assert!(p2.is_defensive());
    }
}

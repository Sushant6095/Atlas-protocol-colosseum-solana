//! Stage 10 — SerializeCanonical.
//!
//! Builds the 268-byte v2 public input from the upstream commitments.
//! Delegates encoding to `atlas-public-input` — single source of truth (I-4, I-9).

use crate::stage::StageError;
use atlas_public_input::{PublicInputV2, FLAG_DEFENSIVE_MODE, FLAG_REPLAY, SIZE};

#[derive(Clone, Debug)]
pub struct SerializeInput {
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub model_hash: [u8; 32],
    pub state_root: [u8; 32],
    pub feature_root: [u8; 32],
    pub consensus_root: [u8; 32],
    pub allocation_root: [u8; 32],
    pub explanation_hash: [u8; 32],
    pub risk_state_hash: [u8; 32],
    pub defensive_mode: bool,
    pub replay: bool,
}

pub fn serialize(input: SerializeInput) -> Result<[u8; SIZE], StageError> {
    let mut flags: u16 = 0;
    if input.defensive_mode {
        flags |= FLAG_DEFENSIVE_MODE;
    }
    if input.replay {
        flags |= FLAG_REPLAY;
    }
    let p = PublicInputV2 {
        flags,
        slot: input.slot,
        vault_id: input.vault_id,
        model_hash: input.model_hash,
        state_root: input.state_root,
        feature_root: input.feature_root,
        consensus_root: input.consensus_root,
        allocation_root: input.allocation_root,
        explanation_hash: input.explanation_hash,
        risk_state_hash: input.risk_state_hash,
    };
    Ok(p.encode())
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_public_input::PublicInputV2;

    fn sample(defensive: bool, replay: bool) -> SerializeInput {
        SerializeInput {
            slot: 0xFEED_BEEF,
            vault_id: [1u8; 32],
            model_hash: [2u8; 32],
            state_root: [3u8; 32],
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            allocation_root: [6u8; 32],
            explanation_hash: [7u8; 32],
            risk_state_hash: [8u8; 32],
            defensive_mode: defensive,
            replay,
        }
    }

    #[test]
    fn round_trip_through_decode() {
        let bytes = serialize(sample(true, false)).unwrap();
        let p = PublicInputV2::decode(&bytes).unwrap();
        assert!(p.is_defensive());
        assert!(!p.is_replay());
        assert_eq!(p.slot, 0xFEED_BEEF);
    }

    #[test]
    fn output_is_268_bytes() {
        let bytes = serialize(sample(false, false)).unwrap();
        assert_eq!(bytes.len(), SIZE);
    }
}

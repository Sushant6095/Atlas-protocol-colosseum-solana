//! `TriggerGate` PDA shape (directive §3.2).

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TriggerGate {
    /// `seeds = [b"atlas-trigger", vault_id, trigger_id]`. The PDA
    /// address is the Jupiter trigger's delegated authority (§3.2).
    pub vault_id: Pubkey,
    pub trigger_id: [u8; 32],
    pub conditions_hash: [u8; 32],
    pub valid_until_slot: u64,
    /// Must equal the vault's approved ensemble (Phase 06 registry).
    pub model_hash: [u8; 32],
    /// Trigger order type tag — declared at creation, immutable.
    pub order_type_tag: u8,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TriggerGateError {
    #[error("trigger gate has expired: valid_until_slot={valid_until_slot}, current_slot={current_slot}")]
    Expired { valid_until_slot: u64, current_slot: u64 },
    #[error("attempted to mutate conditions_hash post-creation; close + recreate required")]
    ConditionsImmutable,
}

impl TriggerGate {
    pub fn check_valid(&self, current_slot: u64) -> Result<(), TriggerGateError> {
        if current_slot >= self.valid_until_slot {
            return Err(TriggerGateError::Expired {
                valid_until_slot: self.valid_until_slot,
                current_slot,
            });
        }
        Ok(())
    }

    /// `assert_unchanged` mirrors the on-chain `TriggerGate` data's
    /// "create-only, never mutate" rule. Any deviation in
    /// `conditions_hash` between proposed and stored returns
    /// `ConditionsImmutable` — the directive's §3.6 last bullet.
    pub fn assert_conditions_unchanged(&self, proposed: &[u8; 32]) -> Result<(), TriggerGateError> {
        if &self.conditions_hash != proposed {
            return Err(TriggerGateError::ConditionsImmutable);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gate() -> TriggerGate {
        TriggerGate {
            vault_id: [1u8; 32],
            trigger_id: [2u8; 32],
            conditions_hash: [3u8; 32],
            valid_until_slot: 200,
            model_hash: [4u8; 32],
            order_type_tag: 1,
        }
    }

    #[test]
    fn valid_within_horizon() {
        gate().check_valid(150).unwrap();
    }

    #[test]
    fn expired_at_or_after_horizon() {
        assert!(matches!(
            gate().check_valid(200),
            Err(TriggerGateError::Expired { .. })
        ));
        assert!(matches!(
            gate().check_valid(250),
            Err(TriggerGateError::Expired { .. })
        ));
    }

    #[test]
    fn matching_conditions_pass() {
        gate().assert_conditions_unchanged(&[3u8; 32]).unwrap();
    }

    #[test]
    fn mutated_conditions_reject() {
        let r = gate().assert_conditions_unchanged(&[7u8; 32]);
        assert!(matches!(r, Err(TriggerGateError::ConditionsImmutable)));
    }
}

//! Account ownership re-derivation (directive §4.2 third bullet).
//!
//! Before every CPI the rebalancer re-derives the expected owner for
//! every passed-in token / state account and rejects if observed owner
//! != expected. This thwarts the "client-provided account metadata"
//! attack where a caller swaps in an attacker-owned account that
//! happens to satisfy a serializer.

use atlas_runtime::Pubkey;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum OwnerCheckError {
    #[error("account {pubkey:?} owner mismatch: expected {expected:?}, got {observed:?}")]
    OwnerMismatch {
        pubkey: Pubkey,
        expected: Pubkey,
        observed: Pubkey,
    },
}

pub fn check_owner(pubkey: Pubkey, expected: Pubkey, observed: Pubkey) -> Result<(), OwnerCheckError> {
    if expected != observed {
        return Err(OwnerCheckError::OwnerMismatch { pubkey, expected, observed });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_match_passes() {
        check_owner([1; 32], [9; 32], [9; 32]).unwrap();
    }

    #[test]
    fn owner_mismatch_rejects() {
        let r = check_owner([1; 32], [9; 32], [4; 32]);
        assert!(matches!(r, Err(OwnerCheckError::OwnerMismatch { .. })));
    }
}

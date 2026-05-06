//! Atlas SDK — typed Rust client for Atlas programs.
//! Phase 1: PDA derivation helpers. Phase 2: full ix builders.

use anchor_lang::prelude::Pubkey;

pub const ATLAS_VERIFIER: Pubkey = anchor_lang::solana_program::pubkey!("AtLasVer1f1er11111111111111111111111111111");
pub const ATLAS_REGISTRY: Pubkey = anchor_lang::solana_program::pubkey!("AtLasReg1stry1111111111111111111111111111");
pub const ATLAS_VAULT: Pubkey = anchor_lang::solana_program::pubkey!("AtLasVau1t11111111111111111111111111111111");
pub const ATLAS_REBALANCER: Pubkey = anchor_lang::solana_program::pubkey!("AtLasReba1ancer11111111111111111111111111");
/// Phase 15 — atlas_keeper_registry program (scoped keeper mandates +
/// independent execution attestations).
pub const ATLAS_KEEPER_REGISTRY: Pubkey = anchor_lang::solana_program::pubkey!("AtLasKpr1Reg1stry111111111111111111111111");

pub mod pda {
    use super::*;

    pub fn vault(deposit_mint: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"vault", deposit_mint.as_ref()], &ATLAS_VAULT)
    }
    pub fn share_mint(deposit_mint: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"share-mint", deposit_mint.as_ref()], &ATLAS_VAULT)
    }
    pub fn vault_authority() -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"vault-auth"], &ATLAS_VAULT)
    }
    pub fn registry() -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"registry"], &ATLAS_REGISTRY)
    }
    pub fn prover_bond(prover: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"prover-bond", prover.as_ref()], &ATLAS_REGISTRY)
    }
    pub fn rebalance_authority() -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"rebalance-auth"], &ATLAS_REBALANCER)
    }

    /// Phase 15 — `KeeperMandate` PDA, one per keeper pubkey.
    pub fn keeper_mandate(keeper: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"keeper-mandate", keeper.as_ref()],
            &ATLAS_KEEPER_REGISTRY,
        )
    }

    /// Phase 15 — `RevokedMandate` archive PDA for the audit trail.
    pub fn revoked_mandate(keeper: &Pubkey, revoked_at_slot: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                b"revoked-mandate",
                keeper.as_ref(),
                &revoked_at_slot.to_le_bytes(),
            ],
            &ATLAS_KEEPER_REGISTRY,
        )
    }

    /// Phase 15 — `ExecutionAttestation` PDA, keyed by the action
    /// signer + slot to make replays unique.
    pub fn execution_attestation(action_keeper: &Pubkey, slot: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                b"execution-attestation",
                action_keeper.as_ref(),
                &slot.to_le_bytes(),
            ],
            &ATLAS_KEEPER_REGISTRY,
        )
    }

    /// Phase 15 — pending-approval bundle PDA, keyed by bundle id.
    pub fn pending_bundle(bundle_id: &[u8; 32]) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"pending-bundle", bundle_id.as_ref()],
            &ATLAS_KEEPER_REGISTRY,
        )
    }
}

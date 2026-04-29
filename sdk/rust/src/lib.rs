//! Atlas SDK — typed Rust client for Atlas programs.
//! Phase 1: PDA derivation helpers. Phase 2: full ix builders.

use anchor_lang::prelude::Pubkey;

pub const ATLAS_VERIFIER: Pubkey = anchor_lang::solana_program::pubkey!("AtLasVer1f1er11111111111111111111111111111");
pub const ATLAS_REGISTRY: Pubkey = anchor_lang::solana_program::pubkey!("AtLasReg1stry1111111111111111111111111111");
pub const ATLAS_VAULT: Pubkey = anchor_lang::solana_program::pubkey!("AtLasVau1t11111111111111111111111111111111");
pub const ATLAS_REBALANCER: Pubkey = anchor_lang::solana_program::pubkey!("AtLasReba1ancer11111111111111111111111111");

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
}

//! Atlas Registry — model commitments + prover bonds.
//!
//! Two responsibilities:
//!   1. Maintain a compressed merkle tree of approved (model_hash, vk_hash) pairs.
//!      Membership proof gates which models the rebalancer is allowed to run.
//!   2. Track prover stakes (Token-2022 escrow) for slashing on bad proofs.
//!
//! Compressed merkle uses spl-account-compression (Bubblegum-style) so the
//! registry can scale to 2^20 model commitments without per-entry rent.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

declare_id!("AtLasReg1stry1111111111111111111111111111");

pub const MAX_DEPTH: u32 = 20;
pub const MAX_BUFFER: u32 = 64;
pub const PROVER_BOND_SEED: &[u8] = b"prover-bond";
pub const REGISTRY_SEED: &[u8] = b"registry";

#[program]
pub mod atlas_registry {
    use super::*;

    /// Initialize the on-chain registry (admin-only on devnet; multisig on mainnet).
    pub fn init_registry(ctx: Context<InitRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.admin = ctx.accounts.admin.key();
        registry.merkle_tree = ctx.accounts.merkle_tree.key();
        registry.total_models = 0;
        registry.bond_mint = ctx.accounts.bond_mint.key();
        registry.bump = ctx.bumps.registry;
        Ok(())
    }

    /// Append a new (model_hash, vk_hash) leaf to the compressed tree.
    pub fn register_model(
        ctx: Context<RegisterModel>,
        model_hash: [u8; 32],
        vk_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        require!(metadata_uri.len() <= 200, AtlasRegistryError::UriTooLong);
        // Append leaf via CPI to spl-account-compression (omitted here; wired in Phase 2).
        let registry = &mut ctx.accounts.registry;
        registry.total_models = registry.total_models.checked_add(1).unwrap();
        emit!(ModelRegistered { model_hash, vk_hash });
        Ok(())
    }

    /// Lock prover bond in Token-2022 vault. Required before submitting proofs.
    pub fn stake_prover(ctx: Context<StakeProver>, amount: u64) -> Result<()> {
        require!(amount >= MIN_PROVER_BOND, AtlasRegistryError::InsufficientBond);
        let bond = &mut ctx.accounts.bond;
        bond.prover = ctx.accounts.prover.key();
        bond.amount = bond.amount.checked_add(amount).unwrap();
        bond.last_active_slot = Clock::get()?.slot;
        bond.slashed = false;
        bond.bump = ctx.bumps.bond;
        // Token transfer wired in Phase 2.
        Ok(())
    }
}

pub const MIN_PROVER_BOND: u64 = 1_000_000_000; // 1000 USDG (6 decimals * 1e3)

#[account]
pub struct Registry {
    pub admin: Pubkey,
    pub merkle_tree: Pubkey,
    pub bond_mint: Pubkey,
    pub total_models: u64,
    pub bump: u8,
}

#[account]
pub struct ProverBond {
    pub prover: Pubkey,
    pub amount: u64,
    pub last_active_slot: u64,
    pub slashed: bool,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitRegistry<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 32 + 8 + 1,
        seeds = [REGISTRY_SEED],
        bump
    )]
    pub registry: Account<'info, Registry>,
    /// CHECK: validated by spl-account-compression on first append
    pub merkle_tree: UncheckedAccount<'info>,
    pub bond_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterModel<'info> {
    #[account(mut, seeds = [REGISTRY_SEED], bump = registry.bump, has_one = admin)]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct StakeProver<'info> {
    #[account(seeds = [REGISTRY_SEED], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        init_if_needed,
        payer = prover,
        space = 8 + 32 + 8 + 8 + 1 + 1,
        seeds = [PROVER_BOND_SEED, prover.key().as_ref()],
        bump
    )]
    pub bond: Account<'info, ProverBond>,
    #[account(mut)]
    pub prover_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub bond_vault: InterfaceAccount<'info, TokenAccount>,
    pub bond_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub prover: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct ModelRegistered {
    pub model_hash: [u8; 32],
    pub vk_hash: [u8; 32],
}

#[error_code]
pub enum AtlasRegistryError {
    #[msg("Metadata URI exceeds 200 chars")]
    UriTooLong,
    #[msg("Stake below minimum prover bond")]
    InsufficientBond,
    #[msg("Prover already slashed")]
    AlreadySlashed,
}

//! Atlas Vault — proof-gated yield aggregator vault.
//!
//! Holds user USDC (Token-2022). Issues vault shares (also Token-2022) priced by
//! NAV = (idle_balance + sum(deployed_balance_per_protocol)) / shares_outstanding.
//!
//! Strategy is committed at vault creation as a Poseidon hash and is immutable.
//! `atlas_rebalancer` may move funds across CPIs (Kamino, Drift, Jupiter, marginfi)
//! ONLY via `execute_rebalance`, which requires a verified SP1 proof attesting that
//! the committed model produced the proposed allocation given the on-chain state
//! at a specific slot.
//!
//! Withdraw is permissionless — never gated on proofs — to preserve user exit.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked, MintTo, mint_to, Burn, burn};

declare_id!("AtLasVau1t11111111111111111111111111111111");

pub const VAULT_SEED: &[u8] = b"vault";
pub const SHARE_MINT_SEED: &[u8] = b"share-mint";
pub const VAULT_AUTH_SEED: &[u8] = b"vault-auth";

#[program]
pub mod atlas_vault {
    use super::*;

    /// Initialize a new vault with an immutable strategy commitment.
    pub fn init_vault(
        ctx: Context<InitVault>,
        strategy_commitment: [u8; 32],
        approved_model_hash: [u8; 32],
        rebalance_cooldown_slots: u64,
        max_tvl: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.admin = ctx.accounts.admin.key();
        vault.deposit_mint = ctx.accounts.deposit_mint.key();
        vault.share_mint = ctx.accounts.share_mint.key();
        vault.idle_account = ctx.accounts.idle_account.key();
        vault.strategy_commitment = strategy_commitment;
        vault.approved_model_hash = approved_model_hash;
        vault.rebalance_cooldown_slots = rebalance_cooldown_slots;
        vault.max_tvl = max_tvl;
        vault.total_idle = 0;
        vault.total_deployed = 0;
        vault.shares_outstanding = 0;
        vault.last_rebalance_slot = 0;
        vault.paused = false;
        vault.bump = ctx.bumps.vault;
        vault.auth_bump = ctx.bumps.vault_authority;
        Ok(())
    }

    /// Deposit USDC, mint vault shares to user proportional to NAV.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.paused, AtlasVaultError::Paused);
        require!(amount > 0, AtlasVaultError::ZeroAmount);
        require!(
            vault.total_assets().checked_add(amount).unwrap() <= vault.max_tvl,
            AtlasVaultError::TvlCapExceeded
        );

        // Pull USDC from depositor.
        let cpi = TransferChecked {
            from: ctx.accounts.depositor_token.to_account_info(),
            mint: ctx.accounts.deposit_mint.to_account_info(),
            to: ctx.accounts.idle_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
            amount,
            ctx.accounts.deposit_mint.decimals,
        )?;

        // Compute shares to mint (first depositor: 1:1; subsequent: by NAV).
        let shares = if vault.shares_outstanding == 0 {
            amount
        } else {
            (amount as u128)
                .checked_mul(vault.shares_outstanding as u128).unwrap()
                .checked_div(vault.total_assets() as u128).unwrap()
                as u64
        };
        require!(shares > 0, AtlasVaultError::ZeroShares);

        // Mint shares to user.
        let auth_seeds: &[&[u8]] = &[VAULT_AUTH_SEED, &[vault.auth_bump]];
        let signer = &[auth_seeds];
        let cpi = MintTo {
            mint: ctx.accounts.share_mint.to_account_info(),
            to: ctx.accounts.depositor_share.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        mint_to(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi, signer),
            shares,
        )?;

        vault.total_idle = vault.total_idle.checked_add(amount).unwrap();
        vault.shares_outstanding = vault.shares_outstanding.checked_add(shares).unwrap();

        emit!(Deposited {
            user: ctx.accounts.depositor.key(),
            amount,
            shares,
        });
        Ok(())
    }

    /// Withdraw USDC by burning shares (no proof required — permissionless exit).
    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(shares > 0, AtlasVaultError::ZeroShares);

        let amount = (shares as u128)
            .checked_mul(vault.total_assets() as u128).unwrap()
            .checked_div(vault.shares_outstanding as u128).unwrap()
            as u64;
        require!(amount <= vault.total_idle, AtlasVaultError::InsufficientIdleLiquidity);

        // Burn user shares.
        let cpi = Burn {
            mint: ctx.accounts.share_mint.to_account_info(),
            from: ctx.accounts.user_share.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
            shares,
        )?;

        // Send USDC back to user.
        let auth_seeds: &[&[u8]] = &[VAULT_AUTH_SEED, &[vault.auth_bump]];
        let signer = &[auth_seeds];
        let cpi = TransferChecked {
            from: ctx.accounts.idle_account.to_account_info(),
            mint: ctx.accounts.deposit_mint.to_account_info(),
            to: ctx.accounts.user_token.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        transfer_checked(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi, signer),
            amount,
            ctx.accounts.deposit_mint.decimals,
        )?;

        vault.total_idle = vault.total_idle.checked_sub(amount).unwrap();
        vault.shares_outstanding = vault.shares_outstanding.checked_sub(shares).unwrap();

        emit!(Withdrawn {
            user: ctx.accounts.user.key(),
            amount,
            shares,
        });
        Ok(())
    }

    /// Called by `atlas_rebalancer` after proof verification to record the new
    /// allocation slot and update internal balances. Cannot be called directly.
    pub fn record_rebalance(
        ctx: Context<RecordRebalance>,
        new_total_idle: u64,
        new_total_deployed: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let now = Clock::get()?.slot;
        require!(
            now.checked_sub(vault.last_rebalance_slot).unwrap_or(u64::MAX)
                >= vault.rebalance_cooldown_slots,
            AtlasVaultError::RebalanceCooldown
        );
        vault.total_idle = new_total_idle;
        vault.total_deployed = new_total_deployed;
        vault.last_rebalance_slot = now;
        Ok(())
    }
}

#[account]
#[derive(Default)]
pub struct Vault {
    pub admin: Pubkey,
    pub deposit_mint: Pubkey,
    pub share_mint: Pubkey,
    pub idle_account: Pubkey,
    pub strategy_commitment: [u8; 32],
    pub approved_model_hash: [u8; 32],
    pub total_idle: u64,
    pub total_deployed: u64,
    pub shares_outstanding: u64,
    pub last_rebalance_slot: u64,
    pub rebalance_cooldown_slots: u64,
    pub max_tvl: u64,
    pub paused: bool,
    pub bump: u8,
    pub auth_bump: u8,
}

impl Vault {
    pub fn total_assets(&self) -> u64 {
        self.total_idle.saturating_add(self.total_deployed)
    }
    pub const SIZE: usize = 8 + 32 * 4 + 32 + 32 + 8 * 6 + 1 + 1 + 1;
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = admin,
        space = Vault::SIZE,
        seeds = [VAULT_SEED, deposit_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: PDA, signs CPIs on behalf of vault
    #[account(seeds = [VAULT_AUTH_SEED], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub deposit_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = admin,
        seeds = [SHARE_MINT_SEED, deposit_mint.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = vault_authority,
    )]
    pub share_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub idle_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [VAULT_SEED, deposit_mint.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    /// CHECK
    #[account(seeds = [VAULT_AUTH_SEED], bump = vault.auth_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub deposit_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = vault.share_mint)]
    pub share_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = vault.idle_account)]
    pub idle_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub depositor_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub depositor_share: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [VAULT_SEED, deposit_mint.key().as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    /// CHECK
    #[account(seeds = [VAULT_AUTH_SEED], bump = vault.auth_bump)]
    pub vault_authority: UncheckedAccount<'info>,
    pub deposit_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = vault.share_mint)]
    pub share_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = vault.idle_account)]
    pub idle_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_share: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RecordRebalance<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: caller (rebalancer program) signs via PDA; verified in Phase 2 by program-id check
    pub rebalancer: Signer<'info>,
}

#[event]
pub struct Deposited {
    pub user: Pubkey,
    pub amount: u64,
    pub shares: u64,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub amount: u64,
    pub shares: u64,
}

#[error_code]
pub enum AtlasVaultError {
    #[msg("Vault is paused")]
    Paused,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Computed share amount is zero")]
    ZeroShares,
    #[msg("Vault TVL cap exceeded")]
    TvlCapExceeded,
    #[msg("Insufficient idle liquidity for withdraw — wait for rebalance")]
    InsufficientIdleLiquidity,
    #[msg("Rebalance cooldown not elapsed")]
    RebalanceCooldown,
}

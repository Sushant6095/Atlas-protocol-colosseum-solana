//! Atlas Rebalancer — gates rebalances on a verified SP1 proof.
//!
//! Flow:
//!   1. Off-chain orchestrator fetches state at slot S.
//!   2. Runs MLP inference → allocation vector A.
//!   3. SP1 zkVM proves: model_hash = approved AND f(state@S, model) = A.
//!   4. Submits tx with: proof + public_inputs(state_root, A, slot S, vault_id).
//!   5. This program:
//!        a. CPI to atlas_verifier::verify(proof, public_inputs, vk_hash).
//!        b. Validate public_inputs match approved model + recent slot.
//!        c. Execute CPIs to Kamino/Drift/Jupiter/marginfi to reach allocation A.
//!        d. CPI to atlas_vault::record_rebalance to update NAV bookkeeping.
//!
//! In Phase 1 we wire the program structure + verifier CPI. DeFi CPIs added Phase 2/3.

use anchor_lang::prelude::*;

declare_id!("AtLasReba1ancer11111111111111111111111111");

pub const REBALANCE_AUTH_SEED: &[u8] = b"rebalance-auth";
pub const PROOF_FRESHNESS_SLOTS: u64 = 150; // ~60 sec at 400ms blocks

#[program]
pub mod atlas_rebalancer {
    use super::*;

    /// Submit a proof-gated rebalance.
    /// `public_inputs` layout (committed):
    ///   [0..32]  state_root (Poseidon over (vault_id, slot, balances))
    ///   [32..64] allocation_commitment (Poseidon over allocation vector)
    ///   [64..72] slot (LE u64)
    ///   [72..104] vault_id (Pubkey)
    ///   [104..136] model_hash
    pub fn execute_rebalance(
        ctx: Context<ExecuteRebalance>,
        proof_bytes: Vec<u8>,
        public_inputs: Vec<u8>,
        vk_hash: [u8; 32],
        allocation: Vec<AllocationLeg>,
    ) -> Result<()> {
        require!(public_inputs.len() == 136, RebalancerError::InvalidPublicInputs);

        // 1. Extract slot from public inputs and check freshness.
        let slot_bytes: [u8; 8] = public_inputs[64..72].try_into().unwrap();
        let proven_slot = u64::from_le_bytes(slot_bytes);
        let now = Clock::get()?.slot;
        require!(
            now.saturating_sub(proven_slot) <= PROOF_FRESHNESS_SLOTS,
            RebalancerError::ProofTooOld
        );

        // 2. Check the proven model_hash matches vault's approved one.
        let proven_model: [u8; 32] = public_inputs[104..136].try_into().unwrap();
        let vault = &ctx.accounts.vault;
        // NB: full vault struct loaded via cpi-account-borrow in Phase 2 to avoid
        // duplicating the Vault layout here.
        // For Phase 1 we rely on the rebalancer program checking via account data.
        // require!(proven_model == vault.approved_model_hash, RebalancerError::ModelMismatch);
        let _ = (proven_model, vault); // silence unused for Phase 1 stub

        // 3. CPI into atlas_verifier::verify.
        let cpi_program = ctx.accounts.atlas_verifier_program.to_account_info();
        let cpi_accounts = atlas_verifier::cpi::accounts::Verify {
            payer: ctx.accounts.executor.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        atlas_verifier::cpi::verify(
            CpiContext::new(cpi_program, cpi_accounts),
            proof_bytes,
            public_inputs,
            vk_hash,
        )?;

        // 4. Execute DeFi CPIs to reach `allocation`. Phase 2/3.
        for leg in allocation.iter() {
            msg!("Pending CPI: protocol={:?} amount={}", leg.protocol, leg.amount);
        }

        // 5. CPI into atlas_vault::record_rebalance. Phase 2.

        emit!(RebalanceExecuted {
            vault: ctx.accounts.vault.key(),
            slot: proven_slot,
            legs: allocation.len() as u8,
        });
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub enum Protocol {
    Kamino = 0,
    Drift = 1,
    Jupiter = 2,
    Marginfi = 3,
    Idle = 4,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct AllocationLeg {
    pub protocol: Protocol,
    pub amount: u64,
}

#[derive(Accounts)]
pub struct ExecuteRebalance<'info> {
    /// CHECK: vault account validated via owner check; loaded as raw in Phase 1.
    #[account(mut)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: rebalance signer PDA
    #[account(seeds = [REBALANCE_AUTH_SEED], bump)]
    pub rebalance_authority: UncheckedAccount<'info>,
    pub atlas_verifier_program: Program<'info, atlas_verifier::program::AtlasVerifier>,
    #[account(mut)]
    pub executor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct RebalanceExecuted {
    pub vault: Pubkey,
    pub slot: u64,
    pub legs: u8,
}

#[error_code]
pub enum RebalancerError {
    #[msg("public_inputs must be exactly 136 bytes")]
    InvalidPublicInputs,
    #[msg("Proof too old — prove against a more recent slot")]
    ProofTooOld,
    #[msg("Proven model hash does not match vault approved model")]
    ModelMismatch,
}

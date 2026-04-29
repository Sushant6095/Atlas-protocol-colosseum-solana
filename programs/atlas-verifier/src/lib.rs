//! Atlas Verifier — wraps sp1-solana Groth16 verifier so any Solana program
//! can verify a proof of inference via CPI.
//!
//! Public surface:
//!   verify_inference(proof, public_inputs, vk_hash) -> Result<()>
//!
//! Caller responsibility: ensure `vk_hash` matches a model commitment registered
//! in `atlas_registry`. This program does not check registry membership; it
//! only verifies the cryptographic proof. Composition is via CPI from
//! `atlas_rebalancer` (or any third-party consumer).

use anchor_lang::prelude::*;
use sp1_solana::verify_proof_fixed;

declare_id!("AtLasVer1f1er11111111111111111111111111111");

#[program]
pub mod atlas_verifier {
    use super::*;

    /// Verify a Groth16-wrapped SP1 proof on-chain.
    ///
    /// `proof_bytes`: 256-byte Groth16 proof (compressed).
    /// `public_inputs`: serialized public inputs (committed values).
    /// `vk_hash`: 32-byte verification key hash; caller must check this against
    ///            an approved model commitment in `atlas_registry`.
    pub fn verify(
        _ctx: Context<Verify>,
        proof_bytes: Vec<u8>,
        public_inputs: Vec<u8>,
        vk_hash: [u8; 32],
    ) -> Result<()> {
        require!(proof_bytes.len() == 256, AtlasVerifierError::InvalidProofLength);
        require!(public_inputs.len() <= 1024, AtlasVerifierError::PublicInputsTooLarge);

        verify_proof_fixed(&proof_bytes, &public_inputs, &vk_hash)
            .map_err(|_| AtlasVerifierError::ProofVerificationFailed)?;

        emit!(ProofVerified {
            vk_hash,
            public_inputs_len: public_inputs.len() as u32,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Verify<'info> {
    /// Anyone may submit a proof; verification is pure.
    pub payer: Signer<'info>,
    /// Required for emit_cpi (anchor 0.32).
    pub system_program: Program<'info, System>,
}

#[event]
pub struct ProofVerified {
    pub vk_hash: [u8; 32],
    pub public_inputs_len: u32,
}

#[error_code]
pub enum AtlasVerifierError {
    #[msg("Groth16 proof must be exactly 256 bytes")]
    InvalidProofLength,
    #[msg("Public inputs exceed 1024-byte limit")]
    PublicInputsTooLarge,
    #[msg("Proof verification failed")]
    ProofVerificationFailed,
}

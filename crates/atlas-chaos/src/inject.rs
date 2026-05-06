//! `ChaosInject` enum (directive §1.1-§1.5).
//!
//! Every variant carries the parameters the production pipeline reads;
//! injectors perturb **inputs**, never internal stage outputs (anti-
//! pattern §7 first bullet).

use atlas_failure::class::{FeedId, ProtocolId, SourceId};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// 32-byte mint pubkey. Reuses the runtime alias.
pub type Mint = Pubkey;

/// Byte-level mutator for `RpcCorruption` and `ForgedStateRoot`. Three
/// shapes — XOR a byte, replace a slice, truncate. Stays a closed enum
/// (not a function pointer) so chaos runs serialize / replay cleanly.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ByteMutator {
    /// XOR a single byte at `offset` with `value`.
    XorByte { offset: usize, value: u8 },
    /// Replace bytes starting at `offset` with `bytes`.
    Replace { offset: usize, bytes: Vec<u8> },
    /// Truncate the buffer to `len` bytes.
    Truncate { len: usize },
}

impl ByteMutator {
    /// Apply the mutation to `buf` in place. Returns `Err` if the
    /// mutator's offsets exceed the buffer; the harness counts that
    /// as a chaos run failure (the injector itself is broken).
    pub fn apply(&self, buf: &mut Vec<u8>) -> Result<(), MutatorError> {
        match self {
            ByteMutator::XorByte { offset, value } => {
                if *offset >= buf.len() {
                    return Err(MutatorError::OffsetOutOfRange { offset: *offset, len: buf.len() });
                }
                buf[*offset] ^= *value;
                Ok(())
            }
            ByteMutator::Replace { offset, bytes } => {
                if offset + bytes.len() > buf.len() {
                    return Err(MutatorError::OffsetOutOfRange {
                        offset: *offset,
                        len: buf.len(),
                    });
                }
                buf[*offset..*offset + bytes.len()].copy_from_slice(bytes);
                Ok(())
            }
            ByteMutator::Truncate { len } => {
                if *len > buf.len() {
                    return Err(MutatorError::OffsetOutOfRange { offset: *len, len: buf.len() });
                }
                buf.truncate(*len);
                Ok(())
            }
        }
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MutatorError {
    #[error("byte mutator offset {offset} out of buffer length {len}")]
    OffsetOutOfRange { offset: usize, len: usize },
}

/// Top-level injector category — used for the `runbook_coverage`
/// telemetry SLO so we can confirm each category has at least one
/// runbook entry.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InjectorCategory {
    NetworkIngestion,
    Oracle,
    Liquidity,
    Execution,
    Adversarial,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChaosInject {
    // ── Network and ingestion (§1.1) ──────────────────────────────
    RpcLatency { source: SourceId, added_ms: u32 },
    RpcDrop { source: SourceId, prob_bps: u32 },
    RpcCorruption { source: SourceId, account: Pubkey, mutate: ByteMutator },
    QuorumSplit { partition: Vec<SourceId> },
    WebsocketReset { source: SourceId, every_n_slots: u32 },
    OutOfOrderEvents { source: SourceId, max_skew: u32 },

    // ── Oracle (§1.2) ─────────────────────────────────────────────
    OracleDrift { feed_id: FeedId, bps_per_slot: i32 },
    OracleStale { feed_id: FeedId, hold_slots: u32 },
    OracleSync { feed_ids: Vec<FeedId>, jump_bps: i32 },
    PythPullPostFail { miss_rate_bps: u32 },

    // ── Liquidity (§1.3) ──────────────────────────────────────────
    PoolVanish { pool: Pubkey, depth_remaining_bps: u16 },
    ToxicityFlip { pool: Pubkey, score_bps: u32 },
    JupiterRouteSkew { asset_pair: (Mint, Mint), bias_bps: i32 },

    // ── Execution (§1.4) ──────────────────────────────────────────
    CpiFailure { protocol: ProtocolId, error: String, after_n_slots: u32 },
    ComputeOverrun { delta_bps: i32 },
    BundleNotLanded { miss_rate_bps: u32 },
    SlippageBlowout { protocol: ProtocolId, observed_bps: u32 },
    StaleAlt { alt: Pubkey, missing_account: Pubkey },

    // ── Adversarial / security (§1.5) ─────────────────────────────
    StaleProofReplay { delay_slots: u32 },
    ForgedVaultTarget { target: Pubkey },
    ForgedStateRoot { mutation: ByteMutator },
    ProofSubstitution { swap_with: Pubkey },
    ProverByzantine { invalid_proof: bool, delay_ms: u32 },
    KeeperRaceCondition { duplicate_sub: bool },

    // ── Phase 15 — keeper-mandate adversarial (directive 15 §11) ──
    /// Compromised keeper attempts an action outside its role's
    /// allowed bitset (I-18). Program must reject; chaos verifies
    /// the rejection happened at the program ix entry, not later.
    KeeperCrossRoleAttempt { keeper: Pubkey, presented_action: u8 },
    /// Compromised keeper tries to land an action against an expired
    /// mandate (I-19). Program must reject with `MandateExpired`.
    MandateExpiredReuse { keeper: Pubkey, slots_past_expiry: u32 },
    /// Action keeper tries to self-attest (skip the I-20 second
    /// signer). Program must reject with `SameSigner`.
    AttestationSameSigner { keeper: Pubkey },
    /// Stale attestation replay: action lands but the attestation
    /// was signed > MAX_ATTESTATION_STALENESS_SLOTS ago.
    AttestationStale { lag_slots: u32 },
}

impl ChaosInject {
    pub const fn category(&self) -> InjectorCategory {
        match self {
            ChaosInject::RpcLatency { .. }
            | ChaosInject::RpcDrop { .. }
            | ChaosInject::RpcCorruption { .. }
            | ChaosInject::QuorumSplit { .. }
            | ChaosInject::WebsocketReset { .. }
            | ChaosInject::OutOfOrderEvents { .. } => InjectorCategory::NetworkIngestion,

            ChaosInject::OracleDrift { .. }
            | ChaosInject::OracleStale { .. }
            | ChaosInject::OracleSync { .. }
            | ChaosInject::PythPullPostFail { .. } => InjectorCategory::Oracle,

            ChaosInject::PoolVanish { .. }
            | ChaosInject::ToxicityFlip { .. }
            | ChaosInject::JupiterRouteSkew { .. } => InjectorCategory::Liquidity,

            ChaosInject::CpiFailure { .. }
            | ChaosInject::ComputeOverrun { .. }
            | ChaosInject::BundleNotLanded { .. }
            | ChaosInject::SlippageBlowout { .. }
            | ChaosInject::StaleAlt { .. } => InjectorCategory::Execution,

            ChaosInject::StaleProofReplay { .. }
            | ChaosInject::ForgedVaultTarget { .. }
            | ChaosInject::ForgedStateRoot { .. }
            | ChaosInject::ProofSubstitution { .. }
            | ChaosInject::ProverByzantine { .. }
            | ChaosInject::KeeperRaceCondition { .. }
            | ChaosInject::KeeperCrossRoleAttempt { .. }
            | ChaosInject::MandateExpiredReuse { .. }
            | ChaosInject::AttestationSameSigner { .. }
            | ChaosInject::AttestationStale { .. } => InjectorCategory::Adversarial,
        }
    }

    /// Stable text name used in dashboards and reports.
    pub const fn name(&self) -> &'static str {
        match self {
            ChaosInject::RpcLatency { .. } => "rpc_latency",
            ChaosInject::RpcDrop { .. } => "rpc_drop",
            ChaosInject::RpcCorruption { .. } => "rpc_corruption",
            ChaosInject::QuorumSplit { .. } => "quorum_split",
            ChaosInject::WebsocketReset { .. } => "websocket_reset",
            ChaosInject::OutOfOrderEvents { .. } => "out_of_order_events",
            ChaosInject::OracleDrift { .. } => "oracle_drift",
            ChaosInject::OracleStale { .. } => "oracle_stale",
            ChaosInject::OracleSync { .. } => "oracle_sync",
            ChaosInject::PythPullPostFail { .. } => "pyth_pull_post_fail",
            ChaosInject::PoolVanish { .. } => "pool_vanish",
            ChaosInject::ToxicityFlip { .. } => "toxicity_flip",
            ChaosInject::JupiterRouteSkew { .. } => "jupiter_route_skew",
            ChaosInject::CpiFailure { .. } => "cpi_failure",
            ChaosInject::ComputeOverrun { .. } => "compute_overrun",
            ChaosInject::BundleNotLanded { .. } => "bundle_not_landed",
            ChaosInject::SlippageBlowout { .. } => "slippage_blowout",
            ChaosInject::StaleAlt { .. } => "stale_alt",
            ChaosInject::StaleProofReplay { .. } => "stale_proof_replay",
            ChaosInject::ForgedVaultTarget { .. } => "forged_vault_target",
            ChaosInject::ForgedStateRoot { .. } => "forged_state_root",
            ChaosInject::ProofSubstitution { .. } => "proof_substitution",
            ChaosInject::ProverByzantine { .. } => "prover_byzantine",
            ChaosInject::KeeperRaceCondition { .. } => "keeper_race_condition",
            ChaosInject::KeeperCrossRoleAttempt { .. } => "keeper_cross_role_attempt",
            ChaosInject::MandateExpiredReuse { .. } => "mandate_expired_reuse",
            ChaosInject::AttestationSameSigner { .. } => "attestation_same_signer",
            ChaosInject::AttestationStale { .. } => "attestation_stale",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xor_byte_mutator_flips_one_byte() {
        let mut buf = vec![0x00u8; 4];
        ByteMutator::XorByte { offset: 1, value: 0xff }.apply(&mut buf).unwrap();
        assert_eq!(buf, vec![0x00, 0xff, 0x00, 0x00]);
    }

    #[test]
    fn replace_mutator_writes_slice() {
        let mut buf = vec![0u8; 6];
        ByteMutator::Replace { offset: 2, bytes: vec![0xab, 0xcd] }
            .apply(&mut buf)
            .unwrap();
        assert_eq!(buf, vec![0, 0, 0xab, 0xcd, 0, 0]);
    }

    #[test]
    fn truncate_mutator_shortens_buffer() {
        let mut buf = vec![1, 2, 3, 4, 5];
        ByteMutator::Truncate { len: 3 }.apply(&mut buf).unwrap();
        assert_eq!(buf, vec![1, 2, 3]);
    }

    #[test]
    fn out_of_range_mutator_rejects() {
        let mut buf = vec![0u8; 2];
        let r = ByteMutator::XorByte { offset: 5, value: 0x01 }.apply(&mut buf);
        assert!(matches!(r, Err(MutatorError::OffsetOutOfRange { .. })));
    }

    #[test]
    fn category_partitions_the_injectors() {
        let injectors = vec![
            ChaosInject::RpcLatency { source: SourceId(1), added_ms: 200 },
            ChaosInject::OracleDrift { feed_id: FeedId(1), bps_per_slot: 1 },
            ChaosInject::PoolVanish { pool: [0u8; 32], depth_remaining_bps: 100 },
            ChaosInject::ComputeOverrun { delta_bps: 1500 },
            ChaosInject::ForgedVaultTarget { target: [9u8; 32] },
        ];
        let cats: Vec<_> = injectors.iter().map(|i| i.category()).collect();
        assert_eq!(
            cats,
            vec![
                InjectorCategory::NetworkIngestion,
                InjectorCategory::Oracle,
                InjectorCategory::Liquidity,
                InjectorCategory::Execution,
                InjectorCategory::Adversarial,
            ]
        );
    }

    #[test]
    fn injector_names_are_unique() {
        // Build one of every variant and assert no name collisions.
        let injectors = vec![
            ChaosInject::RpcLatency { source: SourceId(0), added_ms: 0 },
            ChaosInject::RpcDrop { source: SourceId(0), prob_bps: 0 },
            ChaosInject::RpcCorruption { source: SourceId(0), account: [0u8; 32], mutate: ByteMutator::XorByte { offset: 0, value: 0 } },
            ChaosInject::QuorumSplit { partition: vec![] },
            ChaosInject::WebsocketReset { source: SourceId(0), every_n_slots: 0 },
            ChaosInject::OutOfOrderEvents { source: SourceId(0), max_skew: 0 },
            ChaosInject::OracleDrift { feed_id: FeedId(0), bps_per_slot: 0 },
            ChaosInject::OracleStale { feed_id: FeedId(0), hold_slots: 0 },
            ChaosInject::OracleSync { feed_ids: vec![], jump_bps: 0 },
            ChaosInject::PythPullPostFail { miss_rate_bps: 0 },
            ChaosInject::PoolVanish { pool: [0u8; 32], depth_remaining_bps: 0 },
            ChaosInject::ToxicityFlip { pool: [0u8; 32], score_bps: 0 },
            ChaosInject::JupiterRouteSkew { asset_pair: ([0u8; 32], [0u8; 32]), bias_bps: 0 },
            ChaosInject::CpiFailure { protocol: ProtocolId(0), error: String::new(), after_n_slots: 0 },
            ChaosInject::ComputeOverrun { delta_bps: 0 },
            ChaosInject::BundleNotLanded { miss_rate_bps: 0 },
            ChaosInject::SlippageBlowout { protocol: ProtocolId(0), observed_bps: 0 },
            ChaosInject::StaleAlt { alt: [0u8; 32], missing_account: [0u8; 32] },
            ChaosInject::StaleProofReplay { delay_slots: 0 },
            ChaosInject::ForgedVaultTarget { target: [0u8; 32] },
            ChaosInject::ForgedStateRoot { mutation: ByteMutator::XorByte { offset: 0, value: 0 } },
            ChaosInject::ProofSubstitution { swap_with: [0u8; 32] },
            ChaosInject::ProverByzantine { invalid_proof: true, delay_ms: 0 },
            ChaosInject::KeeperRaceCondition { duplicate_sub: true },
        ];
        let mut names: Vec<&str> = injectors.iter().map(|i| i.name()).collect();
        let total = names.len();
        names.sort();
        names.dedup();
        assert_eq!(names.len(), total, "injector names must be unique");
        // Sanity — 24 injector variants per directive §1.1-§1.5.
        assert_eq!(total, 24);
    }
}

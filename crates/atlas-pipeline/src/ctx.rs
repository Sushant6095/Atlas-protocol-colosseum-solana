//! Pipeline context — carried through every stage. Owns the tracing span,
//! current slot, replay flag, and a handle to the archival store.

use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Live,
    Replay,
}

#[derive(Clone, Copy, Debug)]
pub struct RunId(pub u128);

impl RunId {
    pub fn from_slot_and_vault(slot: u64, vault_id: &[u8; 32]) -> Self {
        // Stable across processes — used as the OTel root span correlation key.
        let mut h = [0u8; 16];
        for (i, b) in vault_id.iter().enumerate() {
            h[i % 16] ^= *b;
        }
        let mut x: u128 = 0;
        for (i, b) in slot.to_le_bytes().iter().enumerate() {
            x |= (*b as u128) << (i * 8);
        }
        for (i, b) in h.iter().enumerate() {
            x ^= (*b as u128) << ((i % 16) * 8);
        }
        Self(x)
    }
}

#[derive(Clone, Debug)]
pub struct PipelineCtx {
    pub mode: Mode,
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub run_id: RunId,
    pub archival: Arc<dyn ArchivalStore>,
}

impl PipelineCtx {
    pub fn new_live(slot: u64, vault_id: [u8; 32], archival: Arc<dyn ArchivalStore>) -> Self {
        Self {
            mode: Mode::Live,
            slot,
            vault_id,
            run_id: RunId::from_slot_and_vault(slot, &vault_id),
            archival,
        }
    }

    pub fn new_replay(slot: u64, vault_id: [u8; 32], archival: Arc<dyn ArchivalStore>) -> Self {
        Self {
            mode: Mode::Replay,
            slot,
            vault_id,
            run_id: RunId::from_slot_and_vault(slot, &vault_id),
            archival,
        }
    }

    pub fn is_replay(&self) -> bool {
        matches!(self.mode, Mode::Replay)
    }
}

/// Append-only archival store for completed rebalances.
///
/// I-8: every accepted rebalance writes (slot, public_input_bytes, proof_bytes,
/// explanation_hash, feature_root, tx_signature) before submission.
/// Loss of archival aborts execution — never silently proceed.
#[async_trait::async_trait]
pub trait ArchivalStore: Send + Sync + std::fmt::Debug {
    async fn write_accepted(
        &self,
        slot: u64,
        vault_id: [u8; 32],
        public_input: &[u8],
        proof: &[u8],
        explanation_hash: [u8; 32],
        feature_root: [u8; 32],
        tx_signature: Option<String>,
    ) -> anyhow::Result<()>;

    async fn read_public_input(&self, slot: u64, vault_id: [u8; 32]) -> anyhow::Result<Vec<u8>>;
    async fn read_proof(&self, slot: u64, vault_id: [u8; 32]) -> anyhow::Result<Vec<u8>>;
    async fn read_snapshot(&self, snapshot_id: [u8; 32]) -> anyhow::Result<Vec<u8>>;
}

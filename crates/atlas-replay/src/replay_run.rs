//! `atlas-replay run` — reconstruct a historical rebalance from the archival
//! store and assert byte-identity vs. the archived public input + proof.

use anyhow::{anyhow, Result};
use atlas_pipeline::ctx::ArchivalStore;
use atlas_public_input::PublicInputV2;
use std::sync::Arc;

#[derive(Clone, Debug)]
pub struct ReplayInput {
    pub vault_id: [u8; 32],
    pub slot: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReplayVerdict {
    ByteIdentical,
    Mismatch { detail: String },
    MissingArchive { detail: String },
}

pub async fn run(archival: Arc<dyn ArchivalStore>, input: &ReplayInput) -> Result<ReplayVerdict> {
    let archived_pi = match archival.read_public_input(input.slot, input.vault_id).await {
        Ok(b) => b,
        Err(e) => {
            return Ok(ReplayVerdict::MissingArchive { detail: format!("{e}") });
        }
    };
    let archived_proof = archival.read_proof(input.slot, input.vault_id).await
        .map_err(|e| anyhow!("read proof: {e}"))?;

    let decoded = PublicInputV2::decode(&archived_pi)
        .map_err(|e| anyhow!("decode archived public input: {:?}", e))?;
    if decoded.vault_id != input.vault_id || decoded.slot != input.slot {
        return Ok(ReplayVerdict::Mismatch {
            detail: format!(
                "vault/slot in archive ({:?}/{}) != requested ({:?}/{})",
                decoded.vault_id, decoded.slot, input.vault_id, input.slot
            ),
        });
    }

    // In Phase 2, we will replay stages 01–10 against an archived snapshot to
    // produce the reconstructed public input bytes. For now we re-encode the
    // decoded value and confirm it matches the on-disk bytes byte-for-byte
    // (catches archive-side corruption).
    let re_encoded = decoded.encode();
    if re_encoded.as_slice() != archived_pi.as_slice() {
        return Ok(ReplayVerdict::Mismatch {
            detail: "re-encoded public input does not match archived bytes".into(),
        });
    }

    let _ = archived_proof; // proof byte verification handled by atlas_verifier in Phase 2
    Ok(ReplayVerdict::ByteIdentical)
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::anyhow;
    use std::collections::BTreeMap;
    use std::sync::Mutex;

    #[derive(Debug)]
    struct InMemoryArchive {
        public_inputs: Mutex<BTreeMap<(u64, [u8; 32]), Vec<u8>>>,
        proofs: Mutex<BTreeMap<(u64, [u8; 32]), Vec<u8>>>,
    }

    #[async_trait::async_trait]
    impl ArchivalStore for InMemoryArchive {
        async fn write_accepted(
            &self,
            slot: u64,
            vault_id: [u8; 32],
            public_input: &[u8],
            proof: &[u8],
            _explanation_hash: [u8; 32],
            _feature_root: [u8; 32],
            _tx_signature: Option<String>,
        ) -> Result<()> {
            self.public_inputs
                .lock()
                .map_err(|_| anyhow!("poisoned"))?
                .insert((slot, vault_id), public_input.to_vec());
            self.proofs
                .lock()
                .map_err(|_| anyhow!("poisoned"))?
                .insert((slot, vault_id), proof.to_vec());
            Ok(())
        }
        async fn read_public_input(&self, slot: u64, vault_id: [u8; 32]) -> Result<Vec<u8>> {
            self.public_inputs
                .lock()
                .map_err(|_| anyhow!("poisoned"))?
                .get(&(slot, vault_id))
                .cloned()
                .ok_or_else(|| anyhow!("not found"))
        }
        async fn read_proof(&self, slot: u64, vault_id: [u8; 32]) -> Result<Vec<u8>> {
            self.proofs
                .lock()
                .map_err(|_| anyhow!("poisoned"))?
                .get(&(slot, vault_id))
                .cloned()
                .ok_or_else(|| anyhow!("not found"))
        }
        async fn read_snapshot(&self, _: [u8; 32]) -> Result<Vec<u8>> {
            Ok(vec![])
        }
    }

    fn sample(vault: [u8; 32], slot: u64) -> PublicInputV2 {
        PublicInputV2 {
            flags: 0,
            slot,
            vault_id: vault,
            model_hash: [2u8; 32],
            state_root: [3u8; 32],
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            allocation_root: [6u8; 32],
            explanation_hash: [7u8; 32],
            risk_state_hash: [8u8; 32],
        }
    }

    #[tokio::test]
    async fn byte_identical_on_clean_archive() {
        let archive = Arc::new(InMemoryArchive {
            public_inputs: Default::default(),
            proofs: Default::default(),
        });
        let vault = [1u8; 32];
        let slot = 12_345u64;
        let pi = sample(vault, slot);
        archive
            .write_accepted(slot, vault, &pi.encode(), &[7u8; 256], [0; 32], [0; 32], None)
            .await
            .unwrap();
        let v = run(archive, &ReplayInput { vault_id: vault, slot }).await.unwrap();
        assert_eq!(v, ReplayVerdict::ByteIdentical);
    }

    #[tokio::test]
    async fn missing_archive_returns_missing() {
        let archive = Arc::new(InMemoryArchive {
            public_inputs: Default::default(),
            proofs: Default::default(),
        });
        let v = run(
            archive,
            &ReplayInput { vault_id: [9u8; 32], slot: 999 },
        )
        .await
        .unwrap();
        assert!(matches!(v, ReplayVerdict::MissingArchive { .. }));
    }
}

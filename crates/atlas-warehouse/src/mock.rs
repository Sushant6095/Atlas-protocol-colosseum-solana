//! In-memory `WarehouseClient` for tests + dev. Implements the same
//! idempotency contract as the real backend so test code exercises the
//! same code paths the pipeline uses in production.

use crate::client::{WarehouseClient, WarehouseError, WriteReceipt};
use crate::schema::{
    AccountStateRow, AgentProposalRow, EventRow, FailureClassificationRow, OracleTickRow,
    PoolSnapshotRow, RebalanceRow,
};
use std::collections::BTreeMap;
use std::sync::Mutex;

#[derive(Default)]
struct Inner {
    rebalances: BTreeMap<([u8; 32], u64), RebalanceRow>,
    account_states: BTreeMap<(u64, [u8; 32]), AccountStateRow>,
    oracle_ticks: BTreeMap<(u64, u32, u8), OracleTickRow>,
    pool_snapshots: BTreeMap<(u64, [u8; 32]), PoolSnapshotRow>,
    agent_proposals: BTreeMap<([u8; 32], u8), AgentProposalRow>,
    events: BTreeMap<[u8; 32], EventRow>,
    failures: BTreeMap<(u64, [u8; 32], String), FailureClassificationRow>,
}

#[derive(Default)]
pub struct MockWarehouse {
    inner: Mutex<Inner>,
}

impl MockWarehouse {
    pub fn new() -> Self {
        Self::default()
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Inner>, WarehouseError> {
        self.inner.lock().map_err(|_| WarehouseError::Poisoned)
    }
}

#[async_trait::async_trait]
impl WarehouseClient for MockWarehouse {
    async fn insert_rebalance(&self, row: &RebalanceRow) -> Result<WriteReceipt, WarehouseError> {
        let mut g = self.lock()?;
        let key = (row.vault_id, row.slot);
        let idempotent_hit = if let Some(existing) = g.rebalances.get(&key) {
            if existing.public_input_hash != row.public_input_hash {
                return Err(WarehouseError::IdempotencyCollision {
                    table: "rebalances",
                    detail: format!(
                        "(vault, slot) {key:?} already has public_input_hash {:?}",
                        existing.public_input_hash
                    ),
                });
            }
            true
        } else {
            g.rebalances.insert(key, row.clone());
            false
        };
        Ok(WriteReceipt {
            table: "rebalances",
            primary_key: row.public_input_hash,
            written_at_slot: row.slot,
            idempotent_hit,
        })
    }

    async fn insert_account_state(
        &self,
        row: &AccountStateRow,
    ) -> Result<WriteReceipt, WarehouseError> {
        let mut g = self.lock()?;
        let key = (row.slot, row.pubkey);
        let idempotent_hit = g.account_states.insert(key, row.clone()).is_some();
        Ok(WriteReceipt {
            table: "account_states",
            primary_key: row.data_hash,
            written_at_slot: row.observed_at_slot,
            idempotent_hit,
        })
    }

    async fn insert_oracle_tick(
        &self,
        row: &OracleTickRow,
    ) -> Result<WriteReceipt, WarehouseError> {
        let mut g = self.lock()?;
        let key = (row.slot, row.feed_id, row.source as u8);
        let idempotent_hit = g.oracle_ticks.insert(key, row.clone()).is_some();
        let mut pk = [0u8; 32];
        pk[..8].copy_from_slice(&row.slot.to_le_bytes());
        pk[8..12].copy_from_slice(&row.feed_id.to_le_bytes());
        pk[12] = row.source as u8;
        Ok(WriteReceipt {
            table: "oracle_ticks",
            primary_key: pk,
            written_at_slot: row.slot,
            idempotent_hit,
        })
    }

    async fn insert_pool_snapshot(
        &self,
        row: &PoolSnapshotRow,
    ) -> Result<WriteReceipt, WarehouseError> {
        let mut g = self.lock()?;
        let key = (row.slot, row.pool);
        let idempotent_hit = g.pool_snapshots.insert(key, row.clone()).is_some();
        Ok(WriteReceipt {
            table: "pool_snapshots",
            primary_key: row.snapshot_hash,
            written_at_slot: row.slot,
            idempotent_hit,
        })
    }

    async fn insert_agent_proposal(
        &self,
        row: &AgentProposalRow,
    ) -> Result<WriteReceipt, WarehouseError> {
        let mut g = self.lock()?;
        let key = (row.rebalance_id, row.agent_id);
        let idempotent_hit = g.agent_proposals.insert(key, row.clone()).is_some();
        Ok(WriteReceipt {
            table: "agent_proposals",
            primary_key: row.reasoning_hash,
            written_at_slot: 0,
            idempotent_hit,
        })
    }

    async fn insert_event(&self, row: &EventRow) -> Result<WriteReceipt, WarehouseError> {
        let mut g = self.lock()?;
        let idempotent_hit = g.events.insert(row.event_id, row.clone()).is_some();
        Ok(WriteReceipt {
            table: "events",
            primary_key: row.event_id,
            written_at_slot: row.slot,
            idempotent_hit,
        })
    }

    async fn insert_failure_classification(
        &self,
        row: &FailureClassificationRow,
    ) -> Result<WriteReceipt, WarehouseError> {
        let mut g = self.lock()?;
        let key = (row.slot, row.vault_id, row.stage.clone());
        let idempotent_hit = g.failures.insert(key, row.clone()).is_some();
        Ok(WriteReceipt {
            table: "failure_classifications",
            primary_key: row.message_hash,
            written_at_slot: row.slot,
            idempotent_hit,
        })
    }

    async fn read_rebalance(
        &self,
        vault_id: [u8; 32],
        slot: u64,
    ) -> Result<Option<RebalanceRow>, WarehouseError> {
        let g = self.lock()?;
        Ok(g.rebalances.get(&(vault_id, slot)).cloned())
    }

    async fn read_events_range(
        &self,
        slot_lo: u64,
        slot_hi: u64,
    ) -> Result<Vec<EventRow>, WarehouseError> {
        let g = self.lock()?;
        let mut out: Vec<EventRow> = g
            .events
            .values()
            .filter(|e| e.slot >= slot_lo && e.slot <= slot_hi)
            .cloned()
            .collect();
        out.sort_by_key(|e| (e.slot, e.event_id));
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{OracleSource, RebalanceStatus};

    fn rebalance(vault: [u8; 32], slot: u64, hash: [u8; 32]) -> RebalanceRow {
        RebalanceRow {
            slot,
            vault_id: vault,
            public_input_hash: hash,
            proof_blob_uri: "s3://x".into(),
            explanation_hash: [0u8; 32],
            explanation_json: "{}".into(),
            feature_root: [0u8; 32],
            consensus_root: [0u8; 32],
            risk_state_hash: [0u8; 32],
            allocation_root: [0u8; 32],
            allocation_bps: vec![10_000],
            agent_proposals_uri: "".into(),
            ingest_quorum_n: 3,
            defensive_mode: false,
            tx_signature: vec![0u8; 64],
            landed_slot: Some(slot + 1),
            bundle_id: [0u8; 32],
            prover_id: [0u8; 32],
            proof_gen_ms: 30_000,
            e2e_ms: 60_000,
            status: RebalanceStatus::Landed,
        }
    }

    #[tokio::test]
    async fn idempotent_rebalance_writes_with_same_hash() {
        let w = MockWarehouse::new();
        let r = rebalance([1u8; 32], 100, [9u8; 32]);
        let r1 = w.insert_rebalance(&r).await.unwrap();
        assert!(!r1.idempotent_hit);
        let r2 = w.insert_rebalance(&r).await.unwrap();
        assert!(r2.idempotent_hit);
    }

    #[tokio::test]
    async fn idempotency_collision_on_hash_mismatch() {
        let w = MockWarehouse::new();
        let _ = w.insert_rebalance(&rebalance([1u8; 32], 100, [9u8; 32])).await.unwrap();
        let err = w.insert_rebalance(&rebalance([1u8; 32], 100, [10u8; 32])).await.unwrap_err();
        assert!(matches!(err, WarehouseError::IdempotencyCollision { .. }));
    }

    #[tokio::test]
    async fn read_events_range_returns_only_in_range() {
        let w = MockWarehouse::new();
        for s in 0..100u64 {
            let mut id = [0u8; 32];
            id[..8].copy_from_slice(&s.to_le_bytes());
            let row = EventRow {
                slot: s,
                source: 1,
                epoch: s / 432_000,
                event_id: id,
                canonical_bytes: vec![],
            };
            w.insert_event(&row).await.unwrap();
        }
        let mid = w.read_events_range(40, 50).await.unwrap();
        assert_eq!(mid.len(), 11);
        assert!(mid.iter().all(|e| e.slot >= 40 && e.slot <= 50));
    }

    #[tokio::test]
    async fn oracle_tick_idempotent_on_slot_feed_source() {
        let w = MockWarehouse::new();
        let row = OracleTickRow {
            slot: 100,
            feed_id: 7,
            source: OracleSource::Pyth,
            price_q64: 1_000_000,
            conf_q64: 1,
            publish_slot: 100,
            deviation_bps_vs_consensus: 0,
        };
        let _ = w.insert_oracle_tick(&row).await.unwrap();
        let r2 = w.insert_oracle_tick(&row).await.unwrap();
        assert!(r2.idempotent_hit);
    }
}

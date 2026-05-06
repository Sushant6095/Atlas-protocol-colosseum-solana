//! Write-path gate (directive §3).
//!
//! Phase 01 I-8: every accepted rebalance must write
//! `(slot, public_input_bytes, proof_bytes, explanation_hash, feature_root,
//! tx_signature)` to the archive **before** the bundle is submitted. Loss of
//! archival aborts execution.
//!
//! `archive_then_submit` is the canonical gate: pipeline code calls
//! `archive_then_submit(client, row, |row| submit_bundle(row))`. The submit
//! closure is invoked **only** after the warehouse insert returns a receipt.
//! Any error from the warehouse short-circuits with no submit attempt;
//! Phase 1 stage 16 wires the resulting `Err` to `atlas_archival_failures_total`.

use crate::client::{WarehouseClient, WarehouseError, WriteReceipt};
use crate::schema::RebalanceRow;
use atlas_telemetry::{ARCHIVAL_FAILURES_TOTAL, WAREHOUSE_ARCHIVE_FAILURE_TOTAL};
use std::time::Instant;
use tracing::warn;

#[derive(Debug, thiserror::Error)]
pub enum WritePathError {
    #[error("archive write failed before submit: {0}")]
    ArchiveFailed(#[from] WarehouseError),
    #[error("submit closure failed AFTER successful archive: {0}")]
    SubmitFailed(String),
}

/// Submit-fn return type — domain-error-string + landed slot if known.
pub type SubmitOutcome = Result<Option<u64>, String>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArchivedSubmitReceipt {
    pub archive: WriteReceipt,
    pub landed_slot: Option<u64>,
}

/// Run the archive write, then — only on success — invoke the submit closure.
/// Failure modes (in order):
///   1. Archive write returns `Err`  → return `ArchiveFailed`. Submit MUST NOT
///      run. Telemetry counters bumped.
///   2. Submit closure returns `Err` → return `SubmitFailed`. Archive remains;
///      caller is responsible for marking the rebalance as `aborted` in a
///      follow-up write.
pub async fn archive_then_submit<F, Fut>(
    client: &dyn WarehouseClient,
    row: &RebalanceRow,
    submit: F,
) -> Result<ArchivedSubmitReceipt, WritePathError>
where
    F: FnOnce(&RebalanceRow) -> Fut,
    Fut: std::future::Future<Output = SubmitOutcome>,
{
    let started = Instant::now();
    let archive_result = client.insert_rebalance(row).await;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    atlas_telemetry::WAREHOUSE_WRITE_LAG_MS
        .with_label_values(&["rebalances"])
        .observe(elapsed_ms as f64);

    let receipt = match archive_result {
        Ok(r) => r,
        Err(e) => {
            // Two counters get bumped: the cross-pipeline I-8 alarm
            // (`atlas_archival_failures_total`) and the warehouse-specific
            // signal (`atlas_warehouse_archive_failure_total{table}`).
            ARCHIVAL_FAILURES_TOTAL
                .with_label_values(&[&hex_vault(row.vault_id), "false"])
                .inc();
            WAREHOUSE_ARCHIVE_FAILURE_TOTAL
                .with_label_values(&["rebalances"])
                .inc();
            warn!(
                target: "atlas-warehouse",
                err = %e,
                slot = row.slot,
                "archive write failed — bundle MUST NOT submit"
            );
            return Err(e.into());
        }
    };

    let landed = match submit(row).await {
        Ok(slot) => slot,
        Err(detail) => return Err(WritePathError::SubmitFailed(detail)),
    };

    Ok(ArchivedSubmitReceipt { archive: receipt, landed_slot: landed })
}

fn hex_vault(v: [u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for b in v {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mock::MockWarehouse;
    use crate::schema::RebalanceStatus;

    fn rebalance() -> RebalanceRow {
        RebalanceRow {
            slot: 100,
            vault_id: [1u8; 32],
            public_input_hash: [9u8; 32],
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
            landed_slot: None,
            bundle_id: [0u8; 32],
            prover_id: [0u8; 32],
            proof_gen_ms: 30_000,
            e2e_ms: 60_000,
            status: RebalanceStatus::Proposed,
        }
    }

    /// A `WarehouseClient` that always rejects writes — used to prove the
    /// gate refuses to submit when archive fails (I-8 contract).
    #[derive(Default)]
    struct FailingArchive;

    #[async_trait::async_trait]
    impl WarehouseClient for FailingArchive {
        async fn insert_rebalance(
            &self,
            _: &RebalanceRow,
        ) -> Result<WriteReceipt, WarehouseError> {
            Err(WarehouseError::Unavailable("simulated backend down".into()))
        }
        async fn insert_account_state(&self, _: &crate::schema::AccountStateRow) -> Result<WriteReceipt, WarehouseError> { unimplemented!() }
        async fn insert_oracle_tick(&self, _: &crate::schema::OracleTickRow) -> Result<WriteReceipt, WarehouseError> { unimplemented!() }
        async fn insert_pool_snapshot(&self, _: &crate::schema::PoolSnapshotRow) -> Result<WriteReceipt, WarehouseError> { unimplemented!() }
        async fn insert_agent_proposal(&self, _: &crate::schema::AgentProposalRow) -> Result<WriteReceipt, WarehouseError> { unimplemented!() }
        async fn insert_event(&self, _: &crate::schema::EventRow) -> Result<WriteReceipt, WarehouseError> { unimplemented!() }
        async fn insert_failure_classification(&self, _: &crate::schema::FailureClassificationRow) -> Result<WriteReceipt, WarehouseError> { unimplemented!() }
        async fn read_rebalance(&self, _: [u8; 32], _: u64) -> Result<Option<RebalanceRow>, WarehouseError> { Ok(None) }
        async fn read_events_range(&self, _: u64, _: u64) -> Result<Vec<crate::schema::EventRow>, WarehouseError> { Ok(vec![]) }
    }

    #[tokio::test]
    async fn archive_failure_blocks_submit_per_i_8() {
        let client = FailingArchive::default();
        let submit_called = std::sync::atomic::AtomicBool::new(false);
        let row = rebalance();
        let r = archive_then_submit(&client, &row, |_r| async {
            submit_called.store(true, std::sync::atomic::Ordering::SeqCst);
            Ok(Some(101))
        })
        .await;
        assert!(matches!(r, Err(WritePathError::ArchiveFailed(_))));
        assert!(
            !submit_called.load(std::sync::atomic::Ordering::SeqCst),
            "submit MUST NOT run when archive failed"
        );
    }

    #[tokio::test]
    async fn archive_success_invokes_submit() {
        let client = MockWarehouse::new();
        let row = rebalance();
        let r = archive_then_submit(&client, &row, |_r| async { Ok(Some(101)) }).await.unwrap();
        assert_eq!(r.landed_slot, Some(101));
        assert!(!r.archive.idempotent_hit);
    }

    #[tokio::test]
    async fn submit_failure_after_archive_returns_submit_error() {
        let client = MockWarehouse::new();
        let row = rebalance();
        let r = archive_then_submit(&client, &row, |_r| async {
            Err::<Option<u64>, _>("rpc rejected".into())
        })
        .await;
        assert!(matches!(r, Err(WritePathError::SubmitFailed(_))));
        // Archive write still happened.
        let stored = client.read_rebalance(row.vault_id, row.slot).await.unwrap();
        assert!(stored.is_some());
    }
}

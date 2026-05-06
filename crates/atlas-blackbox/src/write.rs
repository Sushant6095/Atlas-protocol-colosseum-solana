//! Black-box write path (directive §3.2).
//!
//! Validates the record (anti-pattern §7), then routes large fields to S3
//! (proof, proposals, topology) and the slim row to ClickHouse via the
//! Phase 03 `WarehouseClient`. Bubblegum anchoring runs on the next flush
//! boundary in Phase 03's `BubblegumFlusher`.

use crate::record::{BlackBoxRecord, RecordValidationError};
use atlas_warehouse::client::{WarehouseClient, WarehouseError};
use atlas_warehouse::schema::{RebalanceRow, RebalanceStatus};

#[derive(Debug, thiserror::Error)]
pub enum BlackBoxWriteError {
    #[error("record failed validation: {0}")]
    Validation(#[from] RecordValidationError),
    #[error("warehouse write failed: {0}")]
    Warehouse(#[from] WarehouseError),
}

pub async fn write_record(
    client: &dyn WarehouseClient,
    record: &BlackBoxRecord,
) -> Result<(), BlackBoxWriteError> {
    record.validate()?;
    let row = to_rebalance_row(record);
    client.insert_rebalance(&row).await?;
    Ok(())
}

fn to_rebalance_row(r: &BlackBoxRecord) -> RebalanceRow {
    let alloc_bps: Vec<u32> = r
        .balances_after
        .as_ref()
        .map(|v| v.iter().map(|b| (*b as u128 * 10_000 / total(v).max(1)) as u32).collect())
        .unwrap_or_default();
    let public_input_hash = parse_hex32(&r.public_input_hex[..64]);
    RebalanceRow {
        slot: r.slot,
        vault_id: r.vault_id,
        public_input_hash,
        proof_blob_uri: r.proof_uri.clone(),
        explanation_hash: r.explanation_hash,
        explanation_json: String::new(),
        feature_root: r.feature_root,
        consensus_root: r.consensus_root,
        risk_state_hash: r.risk_state_hash,
        allocation_root: [0u8; 32],
        allocation_bps: alloc_bps,
        agent_proposals_uri: r.agent_proposals_uri.clone(),
        ingest_quorum_n: 0,
        defensive_mode: false,
        tx_signature: r.tx_signature.clone().unwrap_or_default(),
        landed_slot: r.landed_slot,
        bundle_id: r.bundle_id,
        prover_id: r.prover_id,
        proof_gen_ms: r.timings_ms.prove_ms,
        e2e_ms: r.timings_ms.ingest_ms
            + r.timings_ms.infer_ms
            + r.timings_ms.prove_ms
            + r.timings_ms.submit_ms,
        status: match r.status {
            crate::record::BlackBoxStatus::Landed => RebalanceStatus::Landed,
            crate::record::BlackBoxStatus::Aborted => RebalanceStatus::Aborted,
            crate::record::BlackBoxStatus::Rejected => RebalanceStatus::Rejected,
        },
    }
}

fn total(v: &[u128]) -> u128 {
    v.iter().sum()
}

fn parse_hex32(s: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap_or(0);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::record::{BlackBoxStatus, CpiTraceEntry, PostConditionResult, Timings};
    use atlas_warehouse::mock::MockWarehouse;

    fn landed_record() -> BlackBoxRecord {
        BlackBoxRecord {
            schema: crate::BLACKBOX_SCHEMA.into(),
            vault_id: [1u8; 32],
            slot: 100,
            status: BlackBoxStatus::Landed,
            before_state_hash: [2u8; 32],
            after_state_hash: Some([3u8; 32]),
            balances_before: vec![1_000, 2_000],
            balances_after: Some(vec![1_500, 1_500]),
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            agent_proposals_uri: "s3://x".into(),
            explanation_hash: [6u8; 32],
            explanation_canonical_uri: "s3://x".into(),
            risk_state_hash: [7u8; 32],
            risk_topology_uri: "s3://x".into(),
            public_input_hex: "ab".repeat(268),
            proof_uri: "s3://x".into(),
            cpi_trace: vec![CpiTraceEntry {
                step: 1,
                program: "Kamino".into(),
                ix: "Deposit".into(),
                cu: 80_000,
                return_data_hash: [0u8; 32],
            }],
            post_conditions: vec![PostConditionResult { invariant: "k".into(), passed: true }],
            failure_class: None,
            tx_signature: Some(vec![0u8; 64]),
            landed_slot: Some(101),
            bundle_id: [8u8; 32],
            prover_id: [9u8; 32],
            timings_ms: Timings { ingest_ms: 100, infer_ms: 50, prove_ms: 30_000, submit_ms: 1_000 },
            telemetry_span_id: "span".into(),
        }
    }

    #[tokio::test]
    async fn write_landed_record_round_trips() {
        let w = MockWarehouse::new();
        let r = landed_record();
        write_record(&w, &r).await.unwrap();
        let row = w.read_rebalance(r.vault_id, r.slot).await.unwrap();
        assert!(row.is_some());
    }

    #[tokio::test]
    async fn write_invalid_record_rejected_before_db() {
        let w = MockWarehouse::new();
        let mut r = landed_record();
        r.balances_after = Some(vec![1]); // length mismatch
        let err = write_record(&w, &r).await.unwrap_err();
        assert!(matches!(err, BlackBoxWriteError::Validation(_)));
        // Verify nothing landed in the warehouse.
        assert!(w.read_rebalance(r.vault_id, r.slot).await.unwrap().is_none());
    }
}

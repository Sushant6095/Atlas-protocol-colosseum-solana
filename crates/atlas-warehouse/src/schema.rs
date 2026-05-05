//! Typed row representations for the 7 authoritative warehouse tables.
//!
//! These structs are the contract between the Rust pipeline and the SQL
//! migrations under `db/clickhouse/` and `db/timescale/`. Adding a column
//! requires:
//!   1. an entry in `migrations.rs::TABLE_VERSIONS`,
//!   2. a SQL migration file (V<NNN>__*.sql) under the relevant DB dir,
//!   3. updating the corresponding row struct here,
//!   4. updating the materialized views in `views.rs` if the column is queried.
//!
//! No silent column adds. Reviewer rejects PRs that touch a row struct
//! without all four steps.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum RebalanceStatus {
    Proposed = 0,
    Submitted = 1,
    Landed = 2,
    Rejected = 3,
    Aborted = 4,
}

impl RebalanceStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            RebalanceStatus::Proposed => "proposed",
            RebalanceStatus::Submitted => "submitted",
            RebalanceStatus::Landed => "landed",
            RebalanceStatus::Rejected => "rejected",
            RebalanceStatus::Aborted => "aborted",
        }
    }
}

/// `rebalances` table — primary key `(vault_id, slot)`. Idempotent on
/// `(slot, vault_id, public_input_hash)`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RebalanceRow {
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub public_input_hash: [u8; 32],
    pub proof_blob_uri: String,
    pub explanation_hash: [u8; 32],
    pub explanation_json: String,
    pub feature_root: [u8; 32],
    pub consensus_root: [u8; 32],
    pub risk_state_hash: [u8; 32],
    pub allocation_root: [u8; 32],
    pub allocation_bps: Vec<u32>,
    pub agent_proposals_uri: String,
    pub ingest_quorum_n: u8,
    pub defensive_mode: bool,
    /// Solana signature — 64 raw bytes, stored as `Vec<u8>` so serde derives
    /// work (`#[derive(Deserialize)]` does not support `[u8; 64]` natively).
    /// Caller asserts `len() == 64` at insert time.
    pub tx_signature: Vec<u8>,
    pub landed_slot: Option<u64>,
    pub bundle_id: [u8; 32],
    pub prover_id: [u8; 32],
    pub proof_gen_ms: u32,
    pub e2e_ms: u32,
    pub status: RebalanceStatus,
}

/// `account_states` Timescale hypertable. Last 30 days of high-cardinality
/// account snapshots; partitioned 1024 slots/chunk; compressed after 6h.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccountStateRow {
    pub slot: u64,
    pub pubkey: [u8; 32],
    pub owner: [u8; 32],
    pub lamports: u64,
    pub data_hash: [u8; 32],
    pub data_zstd: Vec<u8>,
    pub source: u8, // SourceId discriminant
    pub observed_at_slot: u64,
}

/// `oracle_ticks` table.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum OracleSource {
    Pyth = 0,
    Switchboard = 1,
    DexTwap = 2,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct OracleTickRow {
    pub slot: u64,
    pub feed_id: u32,
    pub source: OracleSource,
    pub price_q64: i64,
    pub conf_q64: u64,
    pub publish_slot: u64,
    pub deviation_bps_vs_consensus: i32,
}

/// `pool_snapshots` table.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PoolSnapshotRow {
    pub slot: u64,
    pub pool: [u8; 32],
    pub protocol: [u8; 32],
    pub depth_minus1pct: u64,
    pub depth_plus1pct: u64,
    pub tvl_q64: i128,
    pub util_bps: u32,
    pub snapshot_hash: [u8; 32],
}

/// `agent_proposals` table — keyed on `(rebalance_id, agent_id)`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentProposalRow {
    /// `public_input_hash` of the parent rebalance.
    pub rebalance_id: [u8; 32],
    pub agent_id: u8,
    pub allocation_bps: Vec<u32>,
    pub confidence_bps: u32,
    pub veto: u8, // 0 None, 1 Soft, 2 Hard
    pub rejection_reasons: Vec<String>,
    pub reasoning_hash: [u8; 32],
}

/// Raw bus event log for replay. Partitioned by `source` + `epoch = slot / 432_000`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventRow {
    pub slot: u64,
    pub source: u8,
    pub epoch: u64,
    pub event_id: [u8; 32],
    pub canonical_bytes: Vec<u8>,
}

/// `failure_classifications` (Phase 05 owns full taxonomy).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FailureClassificationRow {
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub stage: String,
    pub class: String,
    pub code: u32,
    pub message_hash: [u8; 32],
    pub remediation_id: Option<String>,
    pub recovered_at_slot: Option<u64>,
}

/// Helper — uniform "table name" identifier used by migrations + telemetry labels.
pub const TABLE_REBALANCES: &str = "rebalances";
pub const TABLE_ACCOUNT_STATES: &str = "account_states";
pub const TABLE_ORACLE_TICKS: &str = "oracle_ticks";
pub const TABLE_POOL_SNAPSHOTS: &str = "pool_snapshots";
pub const TABLE_AGENT_PROPOSALS: &str = "agent_proposals";
pub const TABLE_EVENTS: &str = "events";
pub const TABLE_FAILURE_CLASSIFICATIONS: &str = "failure_classifications";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rebalance_row_serde_round_trip() {
        let r = RebalanceRow {
            slot: 100,
            vault_id: [1u8; 32],
            public_input_hash: [2u8; 32],
            proof_blob_uri: "s3://atlas/proofs/abc".into(),
            explanation_hash: [3u8; 32],
            explanation_json: "{}".into(),
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            risk_state_hash: [6u8; 32],
            allocation_root: [7u8; 32],
            allocation_bps: vec![5_000, 5_000],
            agent_proposals_uri: "s3://atlas/proposals/abc".into(),
            ingest_quorum_n: 3,
            defensive_mode: false,
            tx_signature: vec![8u8; 64],
            landed_slot: Some(101),
            bundle_id: [9u8; 32],
            prover_id: [0xau8; 32],
            proof_gen_ms: 30_000,
            e2e_ms: 60_000,
            status: RebalanceStatus::Landed,
        };
        let s = serde_json::to_string(&r).unwrap();
        let d: RebalanceRow = serde_json::from_str(&s).unwrap();
        assert_eq!(r, d);
    }

    #[test]
    fn rebalance_status_str() {
        assert_eq!(RebalanceStatus::Landed.as_str(), "landed");
    }
}

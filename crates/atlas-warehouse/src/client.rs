//! `WarehouseClient` trait + write-receipt contract.
//!
//! Directive §3:
//!   - Pipeline writes via a single client; no stage talks to ClickHouse /
//!     Timescale / S3 directly.
//!   - Writes are idempotent on `(slot, vault_id, public_input_hash)` for
//!     rebalances; on `event_id` for raw events.
//!   - Every write returns a receipt; the rebalance ix (Phase 01 I-8) cannot
//!     submit until the archive write returns success.

use crate::schema::{
    AccountStateRow, AgentProposalRow, EventRow, FailureClassificationRow, OracleTickRow,
    PoolSnapshotRow, RebalanceRow,
};

#[derive(Debug, thiserror::Error)]
pub enum WarehouseError {
    #[error("backend unavailable: {0}")]
    Unavailable(String),
    #[error("schema mismatch on table `{table}`: {detail}")]
    SchemaMismatch { table: &'static str, detail: String },
    #[error("idempotency key collision on table `{table}`: {detail}")]
    IdempotencyCollision { table: &'static str, detail: String },
    #[error("backend rejected write to `{table}`: {detail}")]
    Rejected { table: &'static str, detail: String },
    #[error("connection poisoned")]
    Poisoned,
}

/// Receipt returned from every successful insert. The rebalance pipeline
/// (Phase 01 stage 16) refuses to submit a bundle whose archive write did not
/// return a receipt.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WriteReceipt {
    pub table: &'static str,
    pub primary_key: [u8; 32],
    pub written_at_slot: u64,
    /// True if the write was a no-op because the row already existed
    /// (idempotency hit).
    pub idempotent_hit: bool,
}

#[async_trait::async_trait]
pub trait WarehouseClient: Send + Sync {
    async fn insert_rebalance(
        &self,
        row: &RebalanceRow,
    ) -> Result<WriteReceipt, WarehouseError>;

    async fn insert_account_state(
        &self,
        row: &AccountStateRow,
    ) -> Result<WriteReceipt, WarehouseError>;

    async fn insert_oracle_tick(
        &self,
        row: &OracleTickRow,
    ) -> Result<WriteReceipt, WarehouseError>;

    async fn insert_pool_snapshot(
        &self,
        row: &PoolSnapshotRow,
    ) -> Result<WriteReceipt, WarehouseError>;

    async fn insert_agent_proposal(
        &self,
        row: &AgentProposalRow,
    ) -> Result<WriteReceipt, WarehouseError>;

    async fn insert_event(&self, row: &EventRow) -> Result<WriteReceipt, WarehouseError>;

    async fn insert_failure_classification(
        &self,
        row: &FailureClassificationRow,
    ) -> Result<WriteReceipt, WarehouseError>;

    /// Read a rebalance row by its primary key.
    async fn read_rebalance(
        &self,
        vault_id: [u8; 32],
        slot: u64,
    ) -> Result<Option<RebalanceRow>, WarehouseError>;

    /// Read raw events for replay over the inclusive `[slot_lo, slot_hi]` range.
    async fn read_events_range(
        &self,
        slot_lo: u64,
        slot_hi: u64,
    ) -> Result<Vec<EventRow>, WarehouseError>;
}

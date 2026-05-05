//! atlas-warehouse — intelligence warehouse + forensic archive.
//!
//! Implements directive 03. Owns:
//!   - schemas mirroring the on-disk representation of all 7 directive tables,
//!   - `WarehouseClient` trait with idempotent typed inserts,
//!   - point-in-time feature store with leakage enforcement,
//!   - Bubblegum anchoring keeper that computes the Poseidon-style Merkle root
//!     over accepted-rebalance receipts and exposes it for on-chain commitment,
//!   - replay API consumed by `atlas-bus replay --archive`,
//!   - forensic HTTP API with Merkle-proof responses.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod schema;
pub mod client;
pub mod mock;
pub mod bubblegum;
pub mod replay;
pub mod feature_store;
pub mod views;
pub mod migrations;

pub use schema::{
    AccountStateRow, AgentProposalRow, EventRow, FailureClassificationRow, OracleTickRow,
    PoolSnapshotRow, RebalanceRow, RebalanceStatus,
};
pub use client::{WarehouseClient, WarehouseError, WriteReceipt};
pub use mock::MockWarehouse;
pub use bubblegum::{BubblegumAnchorKeeper, BubblegumAnchorReceipt, MerkleProof};
pub use feature_store::{FeatureStoreClient, FeatureStoreError, PointInTimeQuery};
pub use replay::{ReplayQuery, ReplayResponse};

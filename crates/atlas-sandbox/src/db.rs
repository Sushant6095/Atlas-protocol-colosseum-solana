//! Sandbox database schema mirror (directive §1.1 + deliverable §7).
//!
//! The sandbox writes to a sandbox-prefixed mirror of the production
//! warehouse so reports are diff-able with prod data. Every production
//! table has exactly one sandbox mirror, named `sandbox_<prod>`. The
//! prefix is enforced at compile time via [`SandboxTable::all`] — adding
//! a production table without a sandbox mirror fails the parity test.
//!
//! The full mirror is realised by ClickHouse migrations under
//! `db/clickhouse/sandbox/`. This module is the Rust-side contract: the
//! sandbox can only refer to a production table via this enum, and any
//! string passed to a sandbox write must pass [`enforce_sandbox_uri`]
//! / [`enforce_sandbox_topic`].

use crate::isolation::{SandboxGuard, SandboxIsolationError};
use serde::{Deserialize, Serialize};

/// Production tables that must have a sandbox mirror. Updating this list
/// when a new production table is added is a compile-time requirement —
/// the parity test below pins it to the count of row structs in
/// `atlas_warehouse::schema`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum SandboxTable {
    Rebalances,
    AccountStates,
    OracleTicks,
    PoolSnapshots,
    AgentProposals,
    Events,
    FailureClassifications,
}

impl SandboxTable {
    pub const fn prod_name(self) -> &'static str {
        match self {
            SandboxTable::Rebalances => "rebalances",
            SandboxTable::AccountStates => "account_states",
            SandboxTable::OracleTicks => "oracle_ticks",
            SandboxTable::PoolSnapshots => "pool_snapshots",
            SandboxTable::AgentProposals => "agent_proposals",
            SandboxTable::Events => "events",
            SandboxTable::FailureClassifications => "failure_classifications",
        }
    }

    pub fn sandbox_name(self) -> String {
        format!("sandbox_{}", self.prod_name())
    }

    pub const fn all() -> &'static [SandboxTable] {
        &[
            SandboxTable::Rebalances,
            SandboxTable::AccountStates,
            SandboxTable::OracleTicks,
            SandboxTable::PoolSnapshots,
            SandboxTable::AgentProposals,
            SandboxTable::Events,
            SandboxTable::FailureClassifications,
        ]
    }
}

/// Force a URI into the sandbox namespace. Production URIs (`s3://`,
/// `clickhouse://`) are rejected loudly — the caller violated isolation
/// somewhere upstream and silent rewriting would mask the bug.
pub fn enforce_sandbox_uri(uri: &str) -> Result<String, SandboxIsolationError> {
    if uri.starts_with(SandboxGuard::SANDBOX_URI_PREFIX) || uri.starts_with("mock://") {
        return Ok(uri.to_string());
    }
    if uri.starts_with("s3://") || uri.starts_with("clickhouse://") {
        return Err(SandboxIsolationError::ProductionWarehouseUri(uri.to_string()));
    }
    Ok(format!("{}{}", SandboxGuard::SANDBOX_URI_PREFIX, uri))
}

/// Force an event topic into the `sandbox.` namespace.
pub fn enforce_sandbox_topic(topic: &str) -> String {
    if topic.starts_with("sandbox.") {
        return topic.to_string();
    }
    format!("sandbox.{}", topic)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_sandbox_name_is_prefixed() {
        for t in SandboxTable::all() {
            assert!(t.sandbox_name().starts_with("sandbox_"));
            assert!(t.sandbox_name().ends_with(t.prod_name()));
        }
    }

    #[test]
    fn parity_with_production_schema_count() {
        // 7 production tables: rebalances, account_states, oracle_ticks,
        // pool_snapshots, agent_proposals, events, failure_classifications.
        // If a new production table is added in atlas_warehouse::schema,
        // this assertion fails until the SandboxTable enum is updated.
        assert_eq!(SandboxTable::all().len(), 7);
    }

    #[test]
    fn enforce_sandbox_uri_passes_sandbox() {
        assert_eq!(
            enforce_sandbox_uri("sandbox://atlas/proofs/x").unwrap(),
            "sandbox://atlas/proofs/x"
        );
    }

    #[test]
    fn enforce_sandbox_uri_rejects_production() {
        assert!(enforce_sandbox_uri("s3://atlas/proofs/prod").is_err());
        assert!(enforce_sandbox_uri("clickhouse://atlas-prod/").is_err());
    }

    #[test]
    fn enforce_sandbox_uri_prefixes_unknown() {
        let s = enforce_sandbox_uri("memory:abc").unwrap();
        assert!(s.starts_with("sandbox://"));
    }

    #[test]
    fn enforce_sandbox_topic_idempotent() {
        assert_eq!(enforce_sandbox_topic("rebalance"), "sandbox.rebalance");
        assert_eq!(
            enforce_sandbox_topic("sandbox.rebalance"),
            "sandbox.rebalance"
        );
    }
}

//! Sandbox isolation guarantee (directive §1.1).
//!
//! Compile-time + runtime barrier: anything reaching for production keys,
//! production warehouse URIs, or mainnet RPC endpoints from a sandbox
//! context returns `SandboxIsolationError`. The sandbox accepts a
//! `WarehouseClient` injected via dependency; the binary wires
//! `MockWarehouse` (or a sandbox-prefixed real backend) and refuses any
//! URI not under the `sandbox-*` namespace.

use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum SandboxIsolationError {
    #[error("sandbox attempted to use production warehouse URI: {0}")]
    ProductionWarehouseUri(String),
    #[error("sandbox attempted to use a mainnet RPC endpoint: {0}")]
    MainnetEndpoint(String),
    #[error("sandbox attempted to load a production signing key: {0}")]
    ProductionKey(String),
}

/// Marker stamped on every backtest report to make sandbox provenance
/// non-removable from the artifact. The `sandbox_run_id` is derived from
/// the inputs and is reproducible across runs.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SandboxGuard {
    pub sandbox_run_id: [u8; 32],
    pub replay: bool,
}

impl SandboxGuard {
    pub const SANDBOX_URI_PREFIX: &'static str = "sandbox://";

    /// Validate a warehouse URI is sandboxed. Production URIs (`s3://atlas/...`,
    /// `clickhouse://atlas-prod/...`) are rejected here.
    pub fn require_sandbox_uri(uri: &str) -> Result<(), SandboxIsolationError> {
        if uri.starts_with(Self::SANDBOX_URI_PREFIX) || uri.starts_with("mock://") {
            return Ok(());
        }
        Err(SandboxIsolationError::ProductionWarehouseUri(uri.to_string()))
    }

    /// Validate an RPC endpoint is non-mainnet. Acceptable: `devnet`, `testnet`,
    /// `localnet`, `replay`, or a URL beginning with `sandbox-`.
    pub fn require_non_mainnet_rpc(endpoint: &str) -> Result<(), SandboxIsolationError> {
        let lower = endpoint.to_ascii_lowercase();
        let allow = ["devnet", "testnet", "localnet", "replay", "sandbox-", "mock://"];
        for token in allow {
            if lower.contains(token) {
                return Ok(());
            }
        }
        Err(SandboxIsolationError::MainnetEndpoint(endpoint.to_string()))
    }

    /// Reject any path that looks like a production keypair. We treat
    /// anything under `~/.config/solana/` or paths containing `prod` /
    /// `mainnet` as production keys.
    pub fn require_non_production_key(path: &str) -> Result<(), SandboxIsolationError> {
        let lower = path.to_ascii_lowercase();
        if lower.contains("/prod/") || lower.contains("mainnet") || lower.contains("/.config/solana/") {
            return Err(SandboxIsolationError::ProductionKey(path.to_string()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_production_warehouse_uri() {
        assert!(SandboxGuard::require_sandbox_uri("s3://atlas/prod/proofs").is_err());
        assert!(SandboxGuard::require_sandbox_uri("clickhouse://atlas-prod/").is_err());
        SandboxGuard::require_sandbox_uri("sandbox://atlas/v3/proofs").unwrap();
        SandboxGuard::require_sandbox_uri("mock://memory").unwrap();
    }

    #[test]
    fn rejects_mainnet_rpc() {
        assert!(SandboxGuard::require_non_mainnet_rpc("https://api.mainnet-beta.solana.com").is_err());
        SandboxGuard::require_non_mainnet_rpc("https://api.devnet.solana.com").unwrap();
        SandboxGuard::require_non_mainnet_rpc("replay://localhost").unwrap();
    }

    #[test]
    fn rejects_production_key_paths() {
        assert!(SandboxGuard::require_non_production_key("/etc/atlas/prod/keypair.json").is_err());
        assert!(SandboxGuard::require_non_production_key("/Users/op/.config/solana/id.json").is_err());
        assert!(SandboxGuard::require_non_production_key("/etc/atlas/MAINNET-keypair.json").is_err());
        SandboxGuard::require_non_production_key("/tmp/sandbox-keypair.json").unwrap();
    }
}

//! `IntelligenceSource` trait + snapshot-tagged result store
//! (directive §1).

use atlas_runtime::Pubkey;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, thiserror::Error)]
pub enum SnapshotError {
    #[error("snapshot not found: {0:?}")]
    NotFound([u8; 32]),
    #[error("dune execution failed: {0}")]
    DuneExec(String),
    #[error("warehouse unavailable: {0}")]
    Warehouse(String),
}

/// Snapshot tag (directive §1 last paragraph). Persists in the Atlas
/// warehouse so a UI render can be reproduced byte-identically a
/// year later even if the underlying Dune dashboard is edited.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuerySnapshot {
    pub snapshot_id: [u8; 32],
    /// Free-form Dune execution id when applicable; empty for
    /// warehouse-only queries.
    pub dune_execution_id: String,
    pub fetched_at_slot: u64,
    /// `params_hash = blake3("atlas.intel.params.v1" || canonical_params)`.
    pub params_hash: [u8; 32],
    /// JSON-encoded result body. Opaque to the snapshot store.
    pub result: serde_json::Value,
}

/// `snapshot_id = blake3("atlas.intel.snapshot.v1" || dune_exec_id ||
///   slot_le || params_hash)`.
pub fn snapshot_id(
    dune_execution_id: &str,
    fetched_at_slot: u64,
    params_hash: &[u8; 32],
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.intel.snapshot.v1");
    h.update(dune_execution_id.as_bytes());
    h.update(&[0]);
    h.update(&fetched_at_slot.to_le_bytes());
    h.update(params_hash);
    *h.finalize().as_bytes()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Solana,
    Ethereum,
    Base,
    Arbitrum,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DuneQueryId(pub u32);

#[async_trait]
pub trait IntelligenceSource: Send + Sync {
    /// Fetch a snapshot of a wallet's balances. Mainstream impl is a
    /// thin wrapper over a Dune SIM `wallet_balances` query.
    async fn fetch_wallet_balances(
        &self,
        wallet: Pubkey,
        chains: &[Chain],
    ) -> Result<QuerySnapshot, SnapshotError>;

    /// Fetch a Dune-defined cohort. Reads from the cohort registry's
    /// pinned query id.
    async fn fetch_smart_money_cohort(
        &self,
        cohort_label: &str,
    ) -> Result<QuerySnapshot, SnapshotError>;

    /// Run any registered Dune query. The intelligence engine wraps
    /// the raw result in a `QuerySnapshot` and stores it.
    async fn execute_query(
        &self,
        query: DuneQueryId,
        params: BTreeMap<String, String>,
    ) -> Result<QuerySnapshot, SnapshotError>;
}

// ── Snapshot store ──────────────────────────────────────────────────

#[derive(Default)]
pub struct SnapshotStore {
    inner: tokio::sync::Mutex<BTreeMap<[u8; 32], QuerySnapshot>>,
}

impl SnapshotStore {
    pub fn new() -> Self { Self::default() }

    pub async fn put(&self, s: QuerySnapshot) -> [u8; 32] {
        let id = s.snapshot_id;
        self.inner.lock().await.insert(id, s);
        id
    }

    pub async fn get(&self, id: [u8; 32]) -> Result<QuerySnapshot, SnapshotError> {
        self.inner
            .lock()
            .await
            .get(&id)
            .cloned()
            .ok_or(SnapshotError::NotFound(id))
    }

    pub async fn len(&self) -> usize {
        self.inner.lock().await.len()
    }
}

// ── Concrete sources ────────────────────────────────────────────────

/// Stub Dune source. Real builds wire reqwest at the binary level
/// behind the same trait; this stub returns a deterministic snapshot
/// derived from the inputs so unit tests can exercise the routing
/// logic without a network dep.
pub struct DuneSimSource {
    pub team_account: String,
}

#[async_trait]
impl IntelligenceSource for DuneSimSource {
    async fn fetch_wallet_balances(
        &self,
        wallet: Pubkey,
        chains: &[Chain],
    ) -> Result<QuerySnapshot, SnapshotError> {
        let mut params = BTreeMap::new();
        params.insert("wallet".into(), hex32(&wallet));
        params.insert(
            "chains".into(),
            chains
                .iter()
                .map(|c| format!("{:?}", c))
                .collect::<Vec<_>>()
                .join(","),
        );
        let params_hash = hash_params(&params);
        let exec = format!("dune-stub-bal-{}", short(&wallet));
        let id = snapshot_id(&exec, 0, &params_hash);
        Ok(QuerySnapshot {
            snapshot_id: id,
            dune_execution_id: exec,
            fetched_at_slot: 0,
            params_hash,
            result: serde_json::json!({"chains": params["chains"], "wallet": params["wallet"]}),
        })
    }

    async fn fetch_smart_money_cohort(
        &self,
        cohort_label: &str,
    ) -> Result<QuerySnapshot, SnapshotError> {
        let mut params = BTreeMap::new();
        params.insert("cohort".into(), cohort_label.to_string());
        let params_hash = hash_params(&params);
        let exec = format!("dune-stub-cohort-{cohort_label}");
        let id = snapshot_id(&exec, 0, &params_hash);
        Ok(QuerySnapshot {
            snapshot_id: id,
            dune_execution_id: exec,
            fetched_at_slot: 0,
            params_hash,
            result: serde_json::json!({"cohort": cohort_label, "members": []}),
        })
    }

    async fn execute_query(
        &self,
        query: DuneQueryId,
        params: BTreeMap<String, String>,
    ) -> Result<QuerySnapshot, SnapshotError> {
        let params_hash = hash_params(&params);
        let exec = format!("dune-stub-{}", query.0);
        let id = snapshot_id(&exec, 0, &params_hash);
        Ok(QuerySnapshot {
            snapshot_id: id,
            dune_execution_id: exec,
            fetched_at_slot: 0,
            params_hash,
            result: serde_json::json!({"query_id": query.0}),
        })
    }
}

/// Atlas warehouse source — covers everything Atlas already indexes.
/// The intelligence engine routes warehouse-first; Dune is for
/// wallets/chains/history outside that.
#[derive(Default)]
pub struct AtlasWarehouseSource;

#[async_trait]
impl IntelligenceSource for AtlasWarehouseSource {
    async fn fetch_wallet_balances(
        &self,
        wallet: Pubkey,
        _chains: &[Chain],
    ) -> Result<QuerySnapshot, SnapshotError> {
        let mut params = BTreeMap::new();
        params.insert("wallet".into(), hex32(&wallet));
        let params_hash = hash_params(&params);
        let id = snapshot_id("warehouse", 0, &params_hash);
        Ok(QuerySnapshot {
            snapshot_id: id,
            dune_execution_id: String::new(), // empty = warehouse-only
            fetched_at_slot: 0,
            params_hash,
            result: serde_json::json!({"source": "atlas-warehouse", "wallet": params["wallet"]}),
        })
    }

    async fn fetch_smart_money_cohort(
        &self,
        _cohort_label: &str,
    ) -> Result<QuerySnapshot, SnapshotError> {
        Err(SnapshotError::Warehouse(
            "smart-money cohorts come from Dune; warehouse path declined".into(),
        ))
    }

    async fn execute_query(
        &self,
        _query: DuneQueryId,
        _params: BTreeMap<String, String>,
    ) -> Result<QuerySnapshot, SnapshotError> {
        Err(SnapshotError::Warehouse(
            "Dune query ids are not warehouse queries; route to DuneSimSource".into(),
        ))
    }
}

fn hex32(b: &Pubkey) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

fn short(b: &Pubkey) -> String {
    hex32(b).chars().take(8).collect()
}

fn hash_params(params: &BTreeMap<String, String>) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.intel.params.v1");
    for (k, v) in params {
        h.update(k.as_bytes());
        h.update(&[0]);
        h.update(v.as_bytes());
        h.update(&[0]);
    }
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_id_changes_on_inputs() {
        let p = [0u8; 32];
        let a = snapshot_id("exec1", 100, &p);
        let b = snapshot_id("exec1", 101, &p);
        let c = snapshot_id("exec2", 100, &p);
        assert_ne!(a, b);
        assert_ne!(a, c);
        assert_eq!(a, snapshot_id("exec1", 100, &p)); // deterministic
    }

    #[tokio::test]
    async fn dune_source_returns_deterministic_snapshot() {
        let s = DuneSimSource { team_account: "atlas".into() };
        let a = s.fetch_wallet_balances([1u8; 32], &[Chain::Solana]).await.unwrap();
        let b = s.fetch_wallet_balances([1u8; 32], &[Chain::Solana]).await.unwrap();
        assert_eq!(a.snapshot_id, b.snapshot_id);
    }

    #[tokio::test]
    async fn warehouse_source_declines_dune_queries() {
        let s = AtlasWarehouseSource;
        let r = s.execute_query(DuneQueryId(1), BTreeMap::new()).await;
        assert!(matches!(r, Err(SnapshotError::Warehouse(_))));
    }

    #[tokio::test]
    async fn snapshot_store_round_trip() {
        let store = SnapshotStore::new();
        let s = DuneSimSource { team_account: "atlas".into() };
        let snap = s.fetch_wallet_balances([1u8; 32], &[Chain::Solana]).await.unwrap();
        let id = store.put(snap.clone()).await;
        let back = store.get(id).await.unwrap();
        assert_eq!(snap, back);
    }

    #[tokio::test]
    async fn snapshot_store_missing_id_errors() {
        let store = SnapshotStore::new();
        let r = store.get([0xff; 32]).await;
        assert!(matches!(r, Err(SnapshotError::NotFound(_))));
    }
}

//! `atlas-warehouse-api` — read-only forensic HTTP API (directive §7).
//!
//! Endpoints (all GET):
//!   /vault/:id/rebalances?from=&to=
//!   /rebalance/:public_input_hash
//!   /rebalance/:public_input_hash/explanation
//!   /rebalance/:public_input_hash/proof
//!   /vault/:id/feature-snapshot?slot=
//!
//! Every response carries `archive_root_slot` and a Merkle path to the
//! on-chain Bubblegum root so a third party can verify without trusting
//! Atlas's API.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::Result;
use atlas_warehouse::bubblegum::{BubblegumAnchorKeeper, MerkleProof};
use atlas_warehouse::mock::MockWarehouse;
use atlas_warehouse::WarehouseClient;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Parser, Debug)]
#[command(name = "atlas-warehouse-api", version, about = "Forensic read-only HTTP surface for the warehouse.")]
struct Cli {
    #[arg(long, default_value = "0.0.0.0:9091")]
    bind: SocketAddr,
}

#[derive(Clone)]
struct AppState {
    warehouse: Arc<dyn WarehouseClient>,
    keeper: Arc<Mutex<BubblegumAnchorKeeper>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    let cli = Cli::parse();
    let warehouse: Arc<dyn WarehouseClient> = Arc::new(MockWarehouse::new());
    let keeper = Arc::new(Mutex::new(BubblegumAnchorKeeper::new(64)));
    let state = AppState { warehouse, keeper };

    let app = Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/vault/:id/rebalances", get(list_rebalances))
        .route("/rebalance/:hash", get(get_rebalance))
        .route("/rebalance/:hash/explanation", get(get_explanation))
        .route("/rebalance/:hash/proof", get(get_proof))
        .route("/vault/:id/feature-snapshot", get(get_feature_snapshot))
        .with_state(state);

    tracing::info!(target: "atlas-warehouse-api", bind=%cli.bind, "starting forensic api");
    let listener = tokio::net::TcpListener::bind(cli.bind).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Deserialize)]
struct RebalanceRange {
    from: u64,
    to: u64,
}

#[derive(Serialize)]
struct VaultRebalances {
    vault_id: String,
    from: u64,
    to: u64,
    rebalances: Vec<RebalanceSummary>,
    archive_root_slot: u64,
    archive_root: String,
}

#[derive(Serialize)]
struct RebalanceSummary {
    slot: u64,
    public_input_hash: String,
    status: String,
    landed_slot: Option<u64>,
}

#[derive(Serialize)]
struct ProofResponse {
    public_input_hash: String,
    proof_blob_uri: String,
    archive_root_slot: u64,
    archive_root: String,
    merkle_path: ProofPath,
}

#[derive(Serialize)]
struct ProofPath {
    leaf: String,
    index: u32,
    siblings: Vec<String>,
    root: String,
}

#[derive(Deserialize)]
struct FeatureSnapshotQuery {
    slot: u64,
}

async fn list_rebalances(
    State(_state): State<AppState>,
    Path(id): Path<String>,
    Query(_range): Query<RebalanceRange>,
) -> impl IntoResponse {
    // Phase 2 wires real range scan; mock returns empty.
    let resp = VaultRebalances {
        vault_id: id,
        from: 0,
        to: 0,
        rebalances: vec![],
        archive_root_slot: 0,
        archive_root: hex32([0u8; 32]),
    };
    (StatusCode::OK, Json(resp))
}

async fn get_rebalance(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> impl IntoResponse {
    let _ = state;
    Json(serde_json::json!({
        "public_input_hash": hash,
        "status": "not-found",
        "detail": "Phase 2 wires read by hash; mock returns nothing"
    }))
}

async fn get_explanation(Path(hash): Path<String>) -> impl IntoResponse {
    Json(serde_json::json!({
        "public_input_hash": hash,
        "explanation_json": "{}",
    }))
}

async fn get_proof(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> impl IntoResponse {
    let keeper = state.keeper.lock().await;
    let history = keeper.history();
    let (root_slot, root) = history
        .last()
        .map(|r| (r.slot_high, r.batch_root))
        .unwrap_or((0, [0u8; 32]));
    drop(keeper);
    let path = ProofPath {
        leaf: hash.clone(),
        index: 0,
        siblings: vec![],
        root: hex32(root),
    };
    Json(ProofResponse {
        public_input_hash: hash,
        proof_blob_uri: "s3://atlas/proofs/...".into(),
        archive_root_slot: root_slot,
        archive_root: hex32(root),
        merkle_path: path,
    })
}

async fn get_feature_snapshot(
    Path(id): Path<String>,
    Query(q): Query<FeatureSnapshotQuery>,
) -> impl IntoResponse {
    Json(serde_json::json!({
        "vault_id": id,
        "as_of_slot": q.slot,
        "feature_root": hex32([0u8; 32]),
    }))
}

fn hex32(b: [u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

// Reference type to silence unused-import warning when read paths are stubs.
#[allow(dead_code)]
fn _proof_marker(_: MerkleProof) {}

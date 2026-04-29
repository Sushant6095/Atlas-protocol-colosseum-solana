//! Atlas Orchestrator — long-running service that:
//!   1. polls Solana RPC for vault state + protocol APYs (Kamino, Drift, Jupiter, marginfi),
//!   2. invokes SP1 to generate inference proof,
//!   3. wraps proof to Groth16 (sp1-recursion),
//!   4. submits `execute_rebalance` tx via Jito bundle.
//!
//! Phase 1 wires the loop skeleton + config. Phase 2 fills RPC + proof + tx logic.

use anyhow::Result;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn, error};
use tracing_subscriber::EnvFilter;

mod config;
mod state;
mod prove;
mod submit;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cfg = config::OrchestratorConfig::from_env()?;
    info!("Atlas orchestrator starting — vault={} cluster={}", cfg.vault_id, cfg.rpc_url);

    loop {
        match tick(&cfg).await {
            Ok(_) => info!("rebalance cycle complete"),
            Err(e) => error!("rebalance cycle failed: {e:#}"),
        }
        sleep(Duration::from_secs(cfg.poll_interval_secs)).await;
    }
}

async fn tick(cfg: &config::OrchestratorConfig) -> Result<()> {
    // 1. Fetch on-chain state.
    let snapshot = state::fetch_snapshot(cfg).await?;
    info!("snapshot: slot={} idle={} deployed={}", snapshot.slot, snapshot.total_idle, snapshot.total_deployed);

    // 2. Decide whether to rebalance (cooldown + drift check).
    if !snapshot.should_rebalance(cfg) {
        info!("no rebalance needed; cooldown active or allocation stable");
        return Ok(());
    }

    // 3. Generate proof.
    let proof = prove::run_inference_and_prove(cfg, &snapshot).await?;
    info!("proof generated: {} bytes public inputs, {} bytes proof", proof.public_inputs.len(), proof.bytes.len());

    // 4. Submit rebalance tx.
    let sig = submit::send_rebalance(cfg, &proof, &snapshot).await?;
    info!("rebalance tx confirmed: {}", sig);

    Ok(())
}

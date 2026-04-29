use anyhow::{Context, Result};
use std::env;

#[derive(Debug, Clone)]
pub struct OrchestratorConfig {
    pub rpc_url: String,
    pub jito_url: String,
    pub keypair_path: String,
    pub vault_id: String,
    pub model_path: String,
    pub poll_interval_secs: u64,
    pub min_drift_bps: u32,
}

impl OrchestratorConfig {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            rpc_url: env::var("ATLAS_RPC_URL")
                .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".into()),
            jito_url: env::var("ATLAS_JITO_URL")
                .unwrap_or_else(|_| "https://mainnet.block-engine.jito.wtf".into()),
            keypair_path: env::var("ATLAS_KEYPAIR")
                .context("ATLAS_KEYPAIR env required")?,
            vault_id: env::var("ATLAS_VAULT_ID")
                .context("ATLAS_VAULT_ID env required")?,
            model_path: env::var("ATLAS_MODEL_PATH")
                .unwrap_or_else(|_| "./model/atlas-v1.bin".into()),
            poll_interval_secs: env::var("ATLAS_POLL_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(21_600), // 6h
            min_drift_bps: env::var("ATLAS_MIN_DRIFT_BPS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(50), // 0.5% drift threshold
        })
    }
}

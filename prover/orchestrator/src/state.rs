use anyhow::Result;
use crate::config::OrchestratorConfig;

#[derive(Debug, Clone)]
pub struct StateSnapshot {
    pub slot: u64,
    pub total_idle: u64,
    pub total_deployed: u64,
    pub current_allocation: Vec<f32>,
    pub features: Vec<f32>,
    pub vault_id: [u8; 32],
}

impl StateSnapshot {
    pub fn should_rebalance(&self, _cfg: &OrchestratorConfig) -> bool {
        // Phase 2: compare last_rebalance_slot against now,
        // compute target allocation, check drift > min_drift_bps.
        true
    }
}

pub async fn fetch_snapshot(_cfg: &OrchestratorConfig) -> Result<StateSnapshot> {
    // Phase 2 fills:
    //   - solana RPC: getAccountInfo on vault + idle_account
    //   - Kamino reserve APY query
    //   - Drift perp funding rate
    //   - Jupiter LP APR
    //   - marginfi bank APY
    Ok(StateSnapshot {
        slot: 0,
        total_idle: 0,
        total_deployed: 0,
        current_allocation: vec![0.0; 5],
        features: vec![0.0; 8],
        vault_id: [0u8; 32],
    })
}

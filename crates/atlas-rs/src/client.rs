//! `AtlasClient` — thin client over /api/v1/*.

use crate::transport::{HttpTransport, TransportError};
use atlas_blackbox::BlackBoxRecord;
use atlas_presign::PreSignPayload;
use atlas_public_api::sdk::{verify_proof_response, ApiVerifyError, ProofResponse};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, thiserror::Error)]
pub enum ClientError {
    #[error("transport: {0}")]
    Transport(#[from] TransportError),
    #[error("decode: {0}")]
    Decode(serde_json::Error),
    #[error("proof response invalid: {0}")]
    Proof(#[from] ApiVerifyError),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RebalanceListing {
    pub public_input_hash: [u8; 32],
    pub slot: u64,
    pub status: String,
}

pub struct AtlasClient {
    transport: Arc<dyn HttpTransport>,
}

impl AtlasClient {
    pub fn new(transport: Arc<dyn HttpTransport>) -> Self {
        Self { transport }
    }

    pub async fn get_vault(&self, id: &Pubkey) -> Result<serde_json::Value, ClientError> {
        let bytes = self
            .transport
            .get(&format!("/api/v1/vaults/{}", hex32(id)))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    pub async fn list_rebalances(
        &self,
        vault_id: &Pubkey,
        from: u64,
        to: u64,
    ) -> Result<Vec<RebalanceListing>, ClientError> {
        let bytes = self
            .transport
            .get(&format!(
                "/api/v1/vaults/{}/rebalances?from={}&to={}",
                hex32(vault_id),
                from,
                to,
            ))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    pub async fn get_rebalance(
        &self,
        public_input_hash: &[u8; 32],
    ) -> Result<BlackBoxRecord, ClientError> {
        let bytes = self
            .transport
            .get(&format!(
                "/api/v1/rebalance/{}",
                hex32(public_input_hash)
            ))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Fetch the proof + Bubblegum path. The caller hands the
    /// returned `ProofResponse` to `verify_proof` (which validates
    /// shape) and then to the on-chain `sp1-solana` verifier ix for
    /// the cryptographic check. Letting a third party verify Atlas
    /// without trusting Atlas's API is the directive's hard
    /// requirement (§9 acceptance bar).
    pub async fn get_proof(
        &self,
        public_input_hash: &[u8; 32],
    ) -> Result<ProofResponse, ClientError> {
        let bytes = self
            .transport
            .get(&format!(
                "/api/v1/rebalance/{}/proof",
                hex32(public_input_hash)
            ))
            .await?;
        let r: ProofResponse = serde_json::from_slice(&bytes).map_err(ClientError::Decode)?;
        verify_proof_response(&r)?;
        Ok(r)
    }

    /// Convenience: returns Ok(()) iff the proof response shape
    /// passes the SDK-side sanity check.
    pub fn verify_proof(&self, response: &ProofResponse) -> Result<(), ClientError> {
        verify_proof_response(response).map_err(Into::into)
    }

    pub async fn simulate_deposit(
        &self,
        vault_id: &Pubkey,
        amount_q64: u128,
    ) -> Result<PreSignPayload, ClientError> {
        let body = serde_json::json!({ "vault_id": hex32(vault_id), "amount_q64": amount_q64.to_string() });
        let bytes = self
            .transport
            .post_json("/api/v1/simulate/deposit", body.to_string().as_bytes())
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 11 §14: fetch the wallet intelligence report (Dune SIM
    /// + warehouse joins, snapshot-tagged). Read-only. Never enters
    /// a commitment path.
    pub async fn get_wallet_intelligence(
        &self,
        wallet: &Pubkey,
    ) -> Result<atlas_intelligence::WalletIntelligenceReport, ClientError> {
        let bytes = self
            .transport
            .get(&format!("/api/v1/wallet-intel/{}", hex32(wallet)))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 11 §5.1: fetch the 24h capital flow heatmap.
    pub async fn get_capital_flow_heatmap(
        &self,
        from_slot: u64,
        to_slot: u64,
    ) -> Result<atlas_intelligence::CapitalFlowHeatmap, ClientError> {
        let bytes = self
            .transport
            .get(&format!(
                "/api/v1/intelligence/heatmap?from={from_slot}&to={to_slot}"
            ))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 12 §3 — create a proof-gated Jupiter trigger order.
    /// Returns the freshly-anchored `TriggerGate` PDA shape; the
    /// caller submits the corresponding Jupiter `TriggerOrderV2` ix
    /// authority'd by the PDA.
    pub async fn create_gated_trigger(
        &self,
        request: &serde_json::Value,
    ) -> Result<atlas_trigger_gate::TriggerGate, ClientError> {
        let bytes = self
            .transport
            .post_json("/api/v1/triggers", request.to_string().as_bytes())
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 12 §4 — open an adaptive Jupiter Recurring plan whose
    /// parameters are subsequently mutated only via proof-gated
    /// `update_recurring_plan` ixs.
    pub async fn open_adaptive_recurring(
        &self,
        request: &serde_json::Value,
    ) -> Result<atlas_recurring_plan::RecurringPlan, ClientError> {
        let bytes = self
            .transport
            .post_json("/api/v1/recurring", request.to_string().as_bytes())
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 13 §5 — fetch the cashflow runway forecast for a
    /// business treasury entity.
    pub async fn get_runway(
        &self,
        treasury_id: &Pubkey,
    ) -> Result<atlas_payments::RunwayForecast, ClientError> {
        let bytes = self
            .transport
            .get(&format!("/api/v1/treasury/{}/runway", hex32(treasury_id)))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 13 §4 — fetch the most recent verified Dodo payment
    /// schedule for a treasury entity.
    pub async fn get_payment_schedule(
        &self,
        treasury_id: &Pubkey,
    ) -> Result<atlas_payments::DodoPaymentSchedule, ClientError> {
        let bytes = self
            .transport
            .get(&format!(
                "/api/v1/treasury/{}/payments/schedule",
                hex32(treasury_id)
            ))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 14 §6 — issue a viewing key against a vault's
    /// disclosure policy. The on-chain policy hash binds the
    /// scope; this endpoint returns the off-chain key material the
    /// holder uses to unblind balances within scope.
    pub async fn issue_viewing_key(
        &self,
        request: &serde_json::Value,
    ) -> Result<atlas_confidential::ViewingKey, ClientError> {
        let bytes = self
            .transport
            .post_json("/api/v1/disclosure/viewing-keys", request.to_string().as_bytes())
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 14 §6.4 — revoke a viewing key. Past disclosures still
    /// verify; future disclosures under the rotated key are blocked.
    pub async fn revoke_viewing_key(
        &self,
        key_id_hex: &str,
    ) -> Result<atlas_confidential::ViewingKey, ClientError> {
        let body = serde_json::json!({"key_id": key_id_hex});
        let bytes = self
            .transport
            .post_json(
                "/api/v1/disclosure/viewing-keys/revoke",
                body.to_string().as_bytes(),
            )
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 14 §5 — read the most recent confidential payroll
    /// batch's commitment + entry count. Plaintext amounts require
    /// a viewing key.
    pub async fn get_confidential_payroll_batch(
        &self,
        treasury_id: &Pubkey,
    ) -> Result<atlas_confidential::ConfidentialPayrollBatch, ClientError> {
        let bytes = self
            .transport
            .get(&format!(
                "/api/v1/treasury/{}/confidential/payroll",
                hex32(treasury_id)
            ))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 15 §5 — fetch the four-persona agent dashboard cards.
    /// Maps each user-facing persona (Risk / Yield / Compliance /
    /// Execution) onto the deterministic crate that produces the
    /// behaviour, so an auditor can follow each "agent" back to the
    /// code that runs.
    pub async fn get_agents(&self) -> Result<Vec<atlas_operator_agent::AgentCard>, ClientError> {
        let bytes = self.transport.get("/api/v1/agents").await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 15 §4 — fetch active keeper mandates for a treasury,
    /// each carrying its ratcheted usage counters and remaining
    /// caps. The frontend renders this on `/agents`.
    pub async fn get_keepers(
        &self,
        treasury_id: &Pubkey,
    ) -> Result<Vec<atlas_operator_agent::KeeperMandate>, ClientError> {
        let bytes = self
            .transport
            .get(&format!("/api/v1/treasury/{}/keepers", hex32(treasury_id)))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }

    /// Phase 15 §6 — fetch the pending-approval queue for a
    /// treasury. Each bundle requires a Squads multisig vote before
    /// the agent can advance it; the agent itself never auto-promotes.
    pub async fn get_pending(
        &self,
        treasury_id: &Pubkey,
    ) -> Result<Vec<atlas_operator_agent::PendingBundle>, ClientError> {
        let bytes = self
            .transport
            .get(&format!("/api/v1/treasury/{}/pending", hex32(treasury_id)))
            .await?;
        serde_json::from_slice(&bytes).map_err(ClientError::Decode)
    }
}

fn hex32(b: &[u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transport::MockTransport;
    use atlas_blackbox::{BlackBoxStatus, Timings, BLACKBOX_SCHEMA};

    fn skel() -> BlackBoxRecord {
        BlackBoxRecord {
            schema: BLACKBOX_SCHEMA.into(),
            vault_id: [1u8; 32],
            slot: 100,
            status: BlackBoxStatus::Landed,
            before_state_hash: [0u8; 32],
            after_state_hash: Some([0u8; 32]),
            balances_before: vec![1_000, 2_000],
            balances_after: Some(vec![1_500, 1_500]),
            feature_root: [0u8; 32],
            consensus_root: [0u8; 32],
            agent_proposals_uri: "s3://a".into(),
            explanation_hash: [0u8; 32],
            explanation_canonical_uri: "s3://b".into(),
            risk_state_hash: [0u8; 32],
            risk_topology_uri: "s3://c".into(),
            public_input_hex: "00".repeat(268),
            proof_uri: "s3://d".into(),
            cpi_trace: vec![],
            post_conditions: vec![],
            failure_class: None,
            tx_signature: Some(vec![0u8; 64]),
            landed_slot: Some(101),
            bundle_id: [0u8; 32],
            prover_id: [0u8; 32],
            timings_ms: Timings::default(),
            telemetry_span_id: "x".into(),
        }
    }

    #[tokio::test]
    async fn list_rebalances_round_trip() {
        let mock = MockTransport::new();
        let listing = vec![
            RebalanceListing {
                public_input_hash: [1u8; 32],
                slot: 100,
                status: "landed".into(),
            },
            RebalanceListing {
                public_input_hash: [2u8; 32],
                slot: 110,
                status: "landed".into(),
            },
        ];
        mock.put(
            "/api/v1/vaults/0101010101010101010101010101010101010101010101010101010101010101/rebalances?from=0&to=200",
            serde_json::to_vec(&listing).unwrap(),
        )
        .await;
        let client = AtlasClient::new(Arc::new(mock));
        let r = client.list_rebalances(&[1u8; 32], 0, 200).await.unwrap();
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].slot, 100);
    }

    #[tokio::test]
    async fn get_rebalance_round_trip() {
        let mock = MockTransport::new();
        mock.put(
            "/api/v1/rebalance/0202020202020202020202020202020202020202020202020202020202020202",
            serde_json::to_vec(&skel()).unwrap(),
        )
        .await;
        let client = AtlasClient::new(Arc::new(mock));
        let r = client.get_rebalance(&[2u8; 32]).await.unwrap();
        assert_eq!(r.slot, 100);
    }

    #[tokio::test]
    async fn get_proof_validates_shape() {
        let mock = MockTransport::new();
        let resp = ProofResponse {
            public_input_hex: "00".repeat(268),
            proof_bytes: vec![1u8; 192],
            archive_root_slot: 200,
            archive_root: [9u8; 32],
            merkle_proof_path: vec![[1u8; 32], [2u8; 32]],
            blackbox: skel(),
        };
        mock.put(
            "/api/v1/rebalance/0303030303030303030303030303030303030303030303030303030303030303/proof",
            serde_json::to_vec(&resp).unwrap(),
        )
        .await;
        let client = AtlasClient::new(Arc::new(mock));
        let r = client.get_proof(&[3u8; 32]).await.unwrap();
        assert_eq!(r.archive_root_slot, 200);
    }

    #[tokio::test]
    async fn get_proof_rejects_bad_shape() {
        let mock = MockTransport::new();
        let mut resp = ProofResponse {
            public_input_hex: "ab".into(), // too short
            proof_bytes: vec![1u8; 8],
            archive_root_slot: 0,
            archive_root: [0u8; 32],
            merkle_proof_path: vec![[1u8; 32]],
            blackbox: skel(),
        };
        resp.public_input_hex = "ab".into();
        mock.put(
            "/api/v1/rebalance/0404040404040404040404040404040404040404040404040404040404040404/proof",
            serde_json::to_vec(&resp).unwrap(),
        )
        .await;
        let client = AtlasClient::new(Arc::new(mock));
        let r = client.get_proof(&[4u8; 32]).await;
        assert!(matches!(r, Err(ClientError::Proof(_))));
    }
}

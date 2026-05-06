//! atlas-presign — pre-sign transaction simulation schema (directive 09 §5).
//!
//! Before any user-signed instruction (deposit, withdraw, vault
//! creation, sandbox approval), the client renders a `PreSignPayload`
//! summary inside Solflare's transaction-preview hook. The same
//! payload is exposed via the public `/api/simulate/{ix}` for any
//! wallet that wants to consume it.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

pub const PRESIGN_SCHEMA_V1: &str = "atlas.presign.v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreSignIx {
    Deposit,
    Withdraw,
    VaultCreation,
    SandboxApproval,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WarningSeverity {
    Info,
    Warn,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Warning {
    pub code: String,
    pub severity: WarningSeverity,
    pub detail: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExposureRow {
    pub protocol: String,
    pub bps_after: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreSignPayload {
    pub schema: String,
    pub instruction: PreSignIx,
    pub vault_id: Pubkey,
    pub projected_share_balance: u128,
    pub projected_apy_bps: i32,
    pub projected_protocol_exposure_after: Vec<ExposureRow>,
    pub risk_delta_bps: i32,
    pub fees_total_lamports: u64,
    pub compute_units_estimated: u32,
    pub warnings: Vec<Warning>,
    pub human_summary: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PreSignError {
    #[error("schema must equal `{expected}` (got `{got}`)")]
    BadSchema { expected: &'static str, got: String },
    #[error("projected exposure rows must sum to 10_000 bps (got {0})")]
    ExposureNotUnit(u32),
    #[error("withdraw must produce a non-zero share balance change")]
    EmptyWithdraw,
    #[error("severity escalation: ix `{ix:?}` carries an `Error`-level warning")]
    ErrorSeverity { ix: PreSignIx },
}

impl PreSignPayload {
    pub fn validate(&self) -> Result<(), PreSignError> {
        if self.schema != PRESIGN_SCHEMA_V1 {
            return Err(PreSignError::BadSchema {
                expected: PRESIGN_SCHEMA_V1,
                got: self.schema.clone(),
            });
        }
        let sum: u32 = self.projected_protocol_exposure_after.iter().map(|e| e.bps_after).sum();
        if sum != 10_000 && !self.projected_protocol_exposure_after.is_empty() {
            return Err(PreSignError::ExposureNotUnit(sum));
        }
        if self.instruction == PreSignIx::Withdraw && self.projected_share_balance == 0 {
            return Err(PreSignError::EmptyWithdraw);
        }
        if self.warnings.iter().any(|w| w.severity == WarningSeverity::Error) {
            return Err(PreSignError::ErrorSeverity { ix: self.instruction });
        }
        Ok(())
    }

    pub fn high_risk(&self) -> bool {
        self.warnings.iter().any(|w| w.severity == WarningSeverity::Warn)
            || self.risk_delta_bps.abs() >= 500
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn deposit() -> PreSignPayload {
        PreSignPayload {
            schema: PRESIGN_SCHEMA_V1.into(),
            instruction: PreSignIx::Deposit,
            vault_id: [0xab; 32],
            projected_share_balance: 1_000_000,
            projected_apy_bps: 1_400,
            projected_protocol_exposure_after: vec![
                ExposureRow { protocol: "kamino".into(), bps_after: 6_000 },
                ExposureRow { protocol: "drift".into(), bps_after: 3_000 },
                ExposureRow { protocol: "idle".into(), bps_after: 1_000 },
            ],
            risk_delta_bps: 50,
            fees_total_lamports: 5_000,
            compute_units_estimated: 900_000,
            warnings: vec![],
            human_summary: "Deposit 1_000 USDC into kamino-stable-balanced".into(),
        }
    }

    #[test]
    fn deposit_validates() {
        deposit().validate().unwrap();
    }

    #[test]
    fn bad_schema_rejects() {
        let mut p = deposit();
        p.schema = "atlas.presign.v0".into();
        assert!(matches!(p.validate(), Err(PreSignError::BadSchema { .. })));
    }

    #[test]
    fn exposure_must_sum_to_unit() {
        let mut p = deposit();
        p.projected_protocol_exposure_after[0].bps_after = 5_000; // sum 9_000
        assert!(matches!(p.validate(), Err(PreSignError::ExposureNotUnit(9_000))));
    }

    #[test]
    fn empty_withdraw_rejects() {
        let mut p = deposit();
        p.instruction = PreSignIx::Withdraw;
        p.projected_share_balance = 0;
        assert!(matches!(p.validate(), Err(PreSignError::EmptyWithdraw)));
    }

    #[test]
    fn error_severity_warning_blocks_signing() {
        let mut p = deposit();
        p.warnings.push(Warning {
            code: "MAX_DRAWDOWN".into(),
            severity: WarningSeverity::Error,
            detail: "vault has hit max drawdown".into(),
        });
        assert!(matches!(p.validate(), Err(PreSignError::ErrorSeverity { .. })));
    }

    #[test]
    fn high_risk_flagged_on_warning_or_big_delta() {
        let mut p = deposit();
        p.warnings.push(Warning {
            code: "HIGH_PROTOCOL_CONCENTRATION".into(),
            severity: WarningSeverity::Warn,
            detail: "kamino exposure ≥ 60 %".into(),
        });
        assert!(p.high_risk());

        let mut p = deposit();
        p.risk_delta_bps = -800;
        assert!(p.high_risk());
    }
}

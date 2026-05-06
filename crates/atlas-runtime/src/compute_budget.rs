//! Compute budget instructions + CU forecasting (directive §2.3, §10).
//!
//! Every Atlas transaction begins with:
//!
//! ```text
//! ComputeBudgetInstruction::set_compute_unit_limit(predicted_cu)
//! ComputeBudgetInstruction::set_compute_unit_price(micro_lamports_per_cu)
//! ```
//!
//! `predicted_cu` comes from a per-route CU model; `micro_lamports_per_cu`
//! is the per-vault tip cap from a fee oracle. This module exports the
//! forecaster, the byte serializer for the prefix instructions (so the
//! orchestrator can assemble messages without a full Solana SDK
//! dependency), and the §10 SLO guards.

use serde::{Deserialize, Serialize};

/// SP1 / sp1-solana Groth16 verify is the largest single line item in
/// the rebalance transaction. Treat ≥1.2M as the production p99 SLO.
pub const CU_SLO_P99: u32 = 1_200_000;
/// On-chain ceiling per transaction.
pub const CU_HARD_CAP: u32 = 1_400_000;
/// Allowed prediction drift band (§10): predicted-vs-used must stay
/// within ±15 % (1500 bps).
pub const CU_DRIFT_TOLERANCE_BPS: u32 = 1_500;

/// Compute budget program ID — published by the Solana runtime as
/// `ComputeBudget111111111111111111111111111111`. Stored as raw bytes
/// so this crate doesn't pull `solana-sdk`.
pub const COMPUTE_BUDGET_PROGRAM_ID: [u8; 32] = [
    0x03, 0x06, 0x46, 0x6f, 0xe5, 0x21, 0x17, 0x32,
    0xff, 0xec, 0xad, 0xba, 0x72, 0xc3, 0x9b, 0xe7,
    0xbc, 0x8c, 0xe5, 0xbb, 0xc5, 0xf7, 0x12, 0x6b,
    0x2c, 0x43, 0x9b, 0x3a, 0x40, 0x00, 0x00, 0x00,
];

/// `set_compute_unit_limit` discriminator + LE u32.
fn encode_set_compute_unit_limit(cu: u32) -> [u8; 5] {
    let mut buf = [0u8; 5];
    buf[0] = 2;
    buf[1..].copy_from_slice(&cu.to_le_bytes());
    buf
}

/// `set_compute_unit_price` discriminator + LE u64 (micro-lamports/CU).
fn encode_set_compute_unit_price(price: u64) -> [u8; 9] {
    let mut buf = [0u8; 9];
    buf[0] = 3;
    buf[1..].copy_from_slice(&price.to_le_bytes());
    buf
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComputeBudgetIxs {
    pub limit_data: [u8; 5],
    pub price_data: [u8; 9],
}

impl ComputeBudgetIxs {
    pub fn new(predicted_cu: u32, micro_lamports_per_cu: u64) -> Self {
        Self {
            limit_data: encode_set_compute_unit_limit(predicted_cu),
            price_data: encode_set_compute_unit_price(micro_lamports_per_cu),
        }
    }

    pub fn predicted_cu(&self) -> u32 {
        u32::from_le_bytes([
            self.limit_data[1],
            self.limit_data[2],
            self.limit_data[3],
            self.limit_data[4],
        ])
    }

    pub fn micro_lamports_per_cu(&self) -> u64 {
        u64::from_le_bytes([
            self.price_data[1], self.price_data[2], self.price_data[3], self.price_data[4],
            self.price_data[5], self.price_data[6], self.price_data[7], self.price_data[8],
        ])
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CuPredictionDriftError {
    #[error("CU drift {drift_bps} bps exceeds tolerance {tolerance_bps} bps (predicted={predicted}, used={used})")]
    OutOfBand { predicted: u32, used: u32, drift_bps: u32, tolerance_bps: u32 },
    #[error("predicted CU {predicted} exceeds hard cap {cap}")]
    PredictedAboveCap { predicted: u32, cap: u32 },
    #[error("used CU {used} exceeds hard cap {cap}")]
    UsedAboveCap { used: u32, cap: u32 },
}

/// CU predictor — sums per-step CU baselines and adds a 15 % safety
/// margin so callers stay within the §10 SLO.
#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct CuPredictor {
    pub steps: Vec<CuStep>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CuStep {
    pub label: String,
    pub baseline_cu: u32,
}

impl CuPredictor {
    pub fn new() -> Self { Self::default() }

    pub fn push(&mut self, step: CuStep) {
        self.steps.push(step);
    }

    /// Forecast CU usage. Adds a 15 % safety margin to the sum so the
    /// transaction's `set_compute_unit_limit` is set above the
    /// per-step baseline; the operator forecast model still recommends
    /// `predicted = forecast()`.
    pub fn forecast(&self) -> u32 {
        let baseline: u64 = self.steps.iter().map(|s| s.baseline_cu as u64).sum();
        let with_margin = baseline.saturating_mul(115) / 100;
        with_margin.min(CU_HARD_CAP as u64) as u32
    }

    /// Validate that observed `used_cu` is within ±tolerance of `predicted`.
    pub fn validate_drift(predicted: u32, used: u32) -> Result<u32, CuPredictionDriftError> {
        if predicted > CU_HARD_CAP {
            return Err(CuPredictionDriftError::PredictedAboveCap {
                predicted,
                cap: CU_HARD_CAP,
            });
        }
        if used > CU_HARD_CAP {
            return Err(CuPredictionDriftError::UsedAboveCap {
                used,
                cap: CU_HARD_CAP,
            });
        }
        let p = predicted as i64;
        let u = used as i64;
        let denom = p.max(1);
        let drift_bps = (((u - p).abs() * 10_000) / denom).min(u32::MAX as i64) as u32;
        if drift_bps > CU_DRIFT_TOLERANCE_BPS {
            return Err(CuPredictionDriftError::OutOfBand {
                predicted,
                used,
                drift_bps,
                tolerance_bps: CU_DRIFT_TOLERANCE_BPS,
            });
        }
        Ok(drift_bps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limit_encoding_round_trips() {
        let ixs = ComputeBudgetIxs::new(900_000, 5_000);
        assert_eq!(ixs.predicted_cu(), 900_000);
        assert_eq!(ixs.micro_lamports_per_cu(), 5_000);
    }

    #[test]
    fn predictor_adds_safety_margin() {
        let mut p = CuPredictor::new();
        p.push(CuStep { label: "verify".into(), baseline_cu: 250_000 });
        p.push(CuStep { label: "kamino".into(), baseline_cu: 80_000 });
        // Sum 330_000 → +15 % = 379_500.
        assert_eq!(p.forecast(), 379_500);
    }

    #[test]
    fn predictor_clamps_at_hard_cap() {
        let mut p = CuPredictor::new();
        p.push(CuStep { label: "boom".into(), baseline_cu: 1_400_000 });
        assert_eq!(p.forecast(), CU_HARD_CAP);
    }

    #[test]
    fn drift_within_band_passes() {
        // 900_000 predicted, 920_000 used → ~222 bps drift.
        let drift = CuPredictor::validate_drift(900_000, 920_000).unwrap();
        assert!(drift < CU_DRIFT_TOLERANCE_BPS);
    }

    #[test]
    fn drift_exceeding_tolerance_rejects() {
        // 900_000 predicted, 1_200_000 used → 3_333 bps drift.
        assert!(matches!(
            CuPredictor::validate_drift(900_000, 1_200_000),
            Err(CuPredictionDriftError::OutOfBand { .. })
        ));
    }

    #[test]
    fn cap_violations_caught() {
        assert!(matches!(
            CuPredictor::validate_drift(1_500_000, 100_000),
            Err(CuPredictionDriftError::PredictedAboveCap { .. })
        ));
        assert!(matches!(
            CuPredictor::validate_drift(900_000, 1_500_000),
            Err(CuPredictionDriftError::UsedAboveCap { .. })
        ));
    }
}

//! Stage 03 — ExtractFeatures.
//!
//! Typed feature pipeline. No raw `Vec<f32>` plumbed through the system.
//! Float math is allowed inside the ranker, but quantized to fixed-point i64
//! (scale 1e6, round-half-to-even) before hashing.
//!
//! Features carry per-element lineage: which accounts sourced the value,
//! the slot range read, and a 32-byte content hash. The vector commits as
//! `feature_root = poseidon(b"atlas.feat.v2", merkle_of_canonical_features)`.
//!
//! Mandatory features (directive §4):
//!   - protocol_utilization[i]    bps utilized of supply caps, per protocol
//!   - liquidity_depth_1pct[i]    depth at ±1% slippage envelope
//!   - liquidity_depth_5pct[i]    depth at ±5% slippage envelope
//!   - volatility_30m             Parkinson estimator over OHLC
//!   - volatility_24h             Parkinson estimator over OHLC
//!   - apy_instability[i]         rolling stddev of realized APY (7d)
//!   - oracle_deviation[i]        |pyth - switchboard| / pyth, per asset
//!   - correlation_matrix         pairwise 30d return correlations, lower-triangular
//!   - drawdown_velocity          first derivative of vault NAV (6h window)
//!   - liquidity_stress           withdrawal queue depth / available liquidity
//!   - regime_label               {risk_on, neutral, defensive, crisis}

use crate::{
    ctx::PipelineCtx,
    hashing::{hash_with_tag, merkle_with_tag, tags},
    stage::{Stage, StageError},
};
use std::collections::BTreeMap;

pub const FIXED_SCALE: i64 = 1_000_000;

/// Stable u8 discriminants — wire format is part of the commitment, never reorder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum FeatureId {
    ProtocolUtilization = 0x01,
    LiquidityDepth1Pct = 0x02,
    LiquidityDepth5Pct = 0x03,
    Volatility30m = 0x04,
    Volatility24h = 0x05,
    ApyInstability = 0x06,
    OracleDeviation = 0x07,
    DrawdownVelocity = 0x08,
    LiquidityStress = 0x09,
    RegimeLabel = 0x0A,
    CorrelationCell = 0x0B,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum Regime {
    RiskOn = 0,
    Neutral = 1,
    Defensive = 2,
    Crisis = 3,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeatureLineage {
    pub sources: Vec<[u8; 32]>,
    pub slot_low: u64,
    pub slot_high: u64,
    pub hash: [u8; 32],
}

/// Single feature cell. `protocol_index` interpretation:
///   - `0` for vault-aggregate features (volatility_30m, drawdown_velocity, regime_label, …)
///   - `1..=N` for per-protocol features (protocol_utilization, liquidity_depth, apy_instability, …)
///
/// For correlation cells, `protocol_index` and `secondary_index` together identify the
/// (row, col) pair in the lower-triangular matrix; only `row >= col` cells exist.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Feature {
    pub id: FeatureId,
    pub protocol_index: u8,
    pub secondary_index: u8, // used by CorrelationCell; 0 otherwise
    pub value_q: i64,        // quantized fixed-point (scale 1e6)
    pub lineage: FeatureLineage,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeatureVector {
    /// Sorted deterministically by `(id, protocol_index, secondary_index)` — I-6.
    pub features: Vec<Feature>,
    pub feature_root: [u8; 32],
}

impl FeatureVector {
    pub fn new(mut features: Vec<Feature>) -> Self {
        features.sort_by_key(|f| (f.id, f.protocol_index, f.secondary_index));
        let leaves: Vec<[u8; 32]> = features.iter().map(leaf_hash).collect();
        let feature_root = merkle_with_tag(tags::FEATURE_V2, &leaves);
        Self { features, feature_root }
    }
}

fn leaf_hash(f: &Feature) -> [u8; 32] {
    hash_with_tag(
        tags::FEATURE_V2,
        &[
            &[f.id as u8],
            &[f.protocol_index],
            &[f.secondary_index],
            &f.value_q.to_le_bytes(),
            &f.lineage.hash,
        ],
    )
}

/// Round-half-to-even quantization. Matches the SP1 guest implementation
/// byte-for-byte (the guest uses fixed-point math; this is the bridge).
pub fn quantize(x: f64) -> i64 {
    let scaled = x * FIXED_SCALE as f64;
    scaled.round_ties_even() as i64
}

/// Inverse helper for tests / display only — never used in commitment paths.
pub fn dequantize(q: i64) -> f64 {
    q as f64 / FIXED_SCALE as f64
}

/// OHLC candle for the Parkinson volatility estimator.
#[derive(Clone, Copy, Debug)]
pub struct Candle {
    pub high: f64,
    pub low: f64,
}

/// Parkinson volatility estimator:
///   σ² = (1 / (4 ln 2 · N)) · Σ ln(H_i / L_i)²
///
/// Returns annualized σ given the per-candle interval is `Δt` minutes
/// and we annualize by `sqrt(MIN_PER_YEAR / (Δt · N))`. Caller passes
/// the raw σ (unannualized) and annualizes outside if desired —
/// keeps this function pure and unitless.
pub fn parkinson_volatility(candles: &[Candle]) -> f64 {
    if candles.is_empty() {
        return 0.0;
    }
    let n = candles.len() as f64;
    let denom = 4.0 * std::f64::consts::LN_2 * n;
    let mut acc = 0.0f64;
    for c in candles {
        if c.high <= 0.0 || c.low <= 0.0 || c.high < c.low {
            continue;
        }
        let r = (c.high / c.low).ln();
        acc += r * r;
    }
    (acc / denom).sqrt()
}

/// Sample standard deviation. Bessel-corrected (N-1).
pub fn stddev(samples: &[f64]) -> f64 {
    let n = samples.len();
    if n < 2 {
        return 0.0;
    }
    let mean: f64 = samples.iter().sum::<f64>() / n as f64;
    let var: f64 = samples.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n as f64 - 1.0);
    var.sqrt()
}

/// Pearson correlation. Returns 0 if either series has zero variance.
pub fn correlation(xs: &[f64], ys: &[f64]) -> f64 {
    let n = xs.len();
    if n != ys.len() || n < 2 {
        return 0.0;
    }
    let mx: f64 = xs.iter().sum::<f64>() / n as f64;
    let my: f64 = ys.iter().sum::<f64>() / n as f64;
    let mut num = 0.0;
    let mut dx = 0.0;
    let mut dy = 0.0;
    for i in 0..n {
        let a = xs[i] - mx;
        let b = ys[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    if dx == 0.0 || dy == 0.0 {
        return 0.0;
    }
    num / (dx.sqrt() * dy.sqrt())
}

/// Convert an `N×N` correlation matrix into the lower-triangular cell sequence:
/// `[(0,0), (1,0), (1,1), (2,0), (2,1), (2,2), ...]`. Order is stable across
/// machines (row-major, j ≤ i), giving deterministic hashing.
pub fn lower_triangular_cells(matrix: &[Vec<f64>]) -> Vec<(u8, u8, f64)> {
    let n = matrix.len();
    let mut out = Vec::with_capacity(n * (n + 1) / 2);
    for i in 0..n {
        for j in 0..=i {
            let v = matrix[i].get(j).copied().unwrap_or(0.0);
            out.push((i as u8, j as u8, v));
        }
    }
    out
}

#[derive(Clone, Debug, Default)]
pub struct FeatureInput {
    /// Raw scalar features, keyed by `(FeatureId, protocol_index)`. The
    /// secondary index defaults to 0 for these.
    pub raw: BTreeMap<(FeatureId, u8), (f64, FeatureLineage)>,
    /// Lower-triangular correlation cells. Caller supplies the matrix; we
    /// flatten via `lower_triangular_cells` and quantize per cell.
    pub correlation_matrix: Option<(Vec<Vec<f64>>, FeatureLineage)>,
}

pub struct ExtractFeatures;

#[async_trait::async_trait]
impl Stage for ExtractFeatures {
    const ID: &'static str = "03-extract-features";
    type Input = FeatureInput;
    type Output = FeatureVector;

    async fn run(
        &self,
        _ctx: &PipelineCtx,
        input: FeatureInput,
    ) -> Result<Self::Output, StageError> {
        let mut features = Vec::with_capacity(input.raw.len() + 32);

        for ((id, protocol_index), (raw, lineage)) in input.raw.into_iter() {
            features.push(Feature {
                id,
                protocol_index,
                secondary_index: 0,
                value_q: quantize(raw),
                lineage,
            });
        }

        if let Some((matrix, lineage)) = input.correlation_matrix {
            for (row, col, v) in lower_triangular_cells(&matrix) {
                features.push(Feature {
                    id: FeatureId::CorrelationCell,
                    protocol_index: row,
                    secondary_index: col,
                    value_q: quantize(v),
                    lineage: lineage.clone(),
                });
            }
        }

        Ok(FeatureVector::new(features))
    }

    async fn replay(
        &self,
        ctx: &PipelineCtx,
        input: FeatureInput,
    ) -> Result<Self::Output, StageError> {
        // Stage 03 is pure post-quantization; replay is identical to run.
        self.run(ctx, input).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lineage(h: u8) -> FeatureLineage {
        FeatureLineage {
            sources: vec![[h; 32]],
            slot_low: 1,
            slot_high: 1,
            hash: [h; 32],
        }
    }

    fn f(id: FeatureId, idx: u8, v: i64) -> Feature {
        Feature {
            id,
            protocol_index: idx,
            secondary_index: 0,
            value_q: v,
            lineage: lineage(idx),
        }
    }

    #[test]
    fn feature_root_deterministic() {
        let f1 = f(FeatureId::Volatility30m, 0, 12_345);
        let f2 = f(FeatureId::Volatility24h, 0, 67_890);
        let v_a = FeatureVector::new(vec![f1.clone(), f2.clone()]);
        let v_b = FeatureVector::new(vec![f2, f1]);
        assert_eq!(v_a.feature_root, v_b.feature_root, "input order must not affect root");
    }

    #[test]
    fn quantize_round_half_even() {
        // Banker's rounding: ties → nearest even.
        assert_eq!(quantize(0.0000005), 0);
        assert_eq!(quantize(0.0000015), 2);
        assert_eq!(quantize(-0.0000005), 0);
        assert_eq!(quantize(1.234567), 1_234_567);
    }

    #[test]
    fn parkinson_zero_for_empty() {
        assert_eq!(parkinson_volatility(&[]), 0.0);
    }

    #[test]
    fn parkinson_zero_for_flat() {
        let candles = vec![Candle { high: 100.0, low: 100.0 }; 10];
        assert_eq!(parkinson_volatility(&candles), 0.0);
    }

    #[test]
    fn parkinson_increases_with_range() {
        let calm = vec![Candle { high: 101.0, low: 99.0 }; 30];
        let wild = vec![Candle { high: 110.0, low: 90.0 }; 30];
        assert!(parkinson_volatility(&wild) > parkinson_volatility(&calm));
    }

    #[test]
    fn correlation_within_bounds() {
        let xs = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let ys = vec![2.0, 4.0, 6.0, 8.0, 10.0];
        let zs = vec![5.0, 4.0, 3.0, 2.0, 1.0];
        assert!((correlation(&xs, &ys) - 1.0).abs() < 1e-9);
        assert!((correlation(&xs, &zs) - -1.0).abs() < 1e-9);
    }

    #[test]
    fn lower_triangular_count_correct() {
        let m = vec![
            vec![1.0, 0.0, 0.0],
            vec![0.5, 1.0, 0.0],
            vec![0.3, 0.4, 1.0],
        ];
        let cells = lower_triangular_cells(&m);
        // 3×3 lower-triangular: 1 + 2 + 3 = 6 cells
        assert_eq!(cells.len(), 6);
        assert_eq!(cells[0], (0, 0, 1.0));
        assert_eq!(cells[5], (2, 2, 1.0));
    }

    #[test]
    fn stddev_sample_correction() {
        let s = stddev(&[2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]);
        // Known value with Bessel correction: 2.138...
        assert!((s - 2.138_089_935_299_395_4).abs() < 1e-9);
    }

    #[tokio::test]
    async fn correlation_matrix_in_feature_root() {
        let m = vec![
            vec![1.0, 0.0],
            vec![0.5, 1.0],
        ];
        let mut input = FeatureInput::default();
        input.correlation_matrix = Some((m, lineage(7)));
        let v = ExtractFeatures.run(&dummy_ctx(), input).await.unwrap();
        // 2×2 lower-triangular yields 3 cells.
        assert_eq!(
            v.features.iter().filter(|f| f.id == FeatureId::CorrelationCell).count(),
            3
        );
    }

    fn dummy_ctx() -> PipelineCtx {
        use crate::ctx::{ArchivalStore, Mode, PipelineCtx, RunId};
        use std::sync::Arc;

        #[derive(Debug)]
        struct Stub;
        #[async_trait::async_trait]
        impl ArchivalStore for Stub {
            async fn write_accepted(
                &self,
                _: u64,
                _: [u8; 32],
                _: &[u8],
                _: &[u8],
                _: [u8; 32],
                _: [u8; 32],
                _: Option<String>,
            ) -> anyhow::Result<()> {
                Ok(())
            }
            async fn read_public_input(&self, _: u64, _: [u8; 32]) -> anyhow::Result<Vec<u8>> {
                Ok(vec![])
            }
            async fn read_proof(&self, _: u64, _: [u8; 32]) -> anyhow::Result<Vec<u8>> {
                Ok(vec![])
            }
            async fn read_snapshot(&self, _: [u8; 32]) -> anyhow::Result<Vec<u8>> {
                Ok(vec![])
            }
        }
        PipelineCtx {
            mode: Mode::Live,
            slot: 0,
            vault_id: [0; 32],
            run_id: RunId(0),
            archival: Arc::new(Stub),
        }
    }
}

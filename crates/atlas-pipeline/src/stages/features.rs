//! Stage 03 — ExtractFeatures.
//!
//! Typed feature pipeline. No raw `Vec<f32>` plumbed through the system.
//! Float math is allowed inside the ranker, but quantized to fixed-point i64
//! (scale 1e6, round-half-to-even) before hashing.
//!
//! Features carry per-element lineage: which accounts sourced the value,
//! the slot range read, and a 32-byte content hash. The vector commits as
//! `feature_root = poseidon(b"atlas.feat.v2", merkle_of_canonical_features)`.

use crate::{
    ctx::PipelineCtx,
    hashing::{hash_with_tag, merkle_with_tag, tags},
    stage::{Stage, StageError},
};
use std::collections::BTreeMap;

pub const FIXED_SCALE: i64 = 1_000_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum FeatureId {
    ProtocolUtilization,
    LiquidityDepth1Pct,
    LiquidityDepth5Pct,
    Volatility30m,
    Volatility24h,
    ApyInstability,
    OracleDeviation,
    DrawdownVelocity,
    LiquidityStress,
    RegimeLabel,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeatureLineage {
    pub sources: Vec<[u8; 32]>,
    pub slot_low: u64,
    pub slot_high: u64,
    pub hash: [u8; 32],
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Feature {
    pub id: FeatureId,
    pub protocol_index: u8, // 0 = aggregate, 1.. = per-protocol
    pub value_q: i64,       // quantized fixed-point (scale 1e6)
    pub lineage: FeatureLineage,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FeatureVector {
    /// Sorted deterministically by (id, protocol_index) — I-6.
    pub features: Vec<Feature>,
    pub feature_root: [u8; 32],
}

impl FeatureVector {
    pub fn new(mut features: Vec<Feature>) -> Self {
        features.sort_by_key(|f| (f.id, f.protocol_index));
        let leaves: Vec<[u8; 32]> = features
            .iter()
            .map(|f| {
                hash_with_tag(
                    tags::FEATURE_V2,
                    &[
                        &[f.id as u8],
                        &[f.protocol_index],
                        &f.value_q.to_le_bytes(),
                        &f.lineage.hash,
                    ],
                )
            })
            .collect();
        let feature_root = merkle_with_tag(tags::FEATURE_V2, &leaves);
        Self { features, feature_root }
    }
}

/// Round-half-to-even quantization. Matches the SP1 guest implementation
/// byte-for-byte (the guest uses fixed-point math; this is the bridge).
pub fn quantize(x: f64) -> i64 {
    let scaled = x * FIXED_SCALE as f64;
    // Banker's rounding on .5 — Rust f64::round_ties_even is stable on 1.77+
    scaled.round_ties_even() as i64
}

#[derive(Clone, Debug)]
pub struct FeatureInput {
    pub raw: BTreeMap<(FeatureId, u8), (f64, FeatureLineage)>,
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
        let mut features = Vec::with_capacity(input.raw.len());
        for ((id, protocol_index), (raw, lineage)) in input.raw.into_iter() {
            features.push(Feature {
                id,
                protocol_index,
                value_q: quantize(raw),
                lineage,
            });
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
        FeatureLineage { sources: vec![[h; 32]], slot_low: 1, slot_high: 1, hash: [h; 32] }
    }

    #[test]
    fn feature_root_deterministic() {
        let f1 = Feature { id: FeatureId::Volatility30m, protocol_index: 0, value_q: 12_345, lineage: lineage(1) };
        let f2 = Feature { id: FeatureId::Volatility24h, protocol_index: 0, value_q: 67_890, lineage: lineage(2) };
        let v_a = FeatureVector::new(vec![f1.clone(), f2.clone()]);
        let v_b = FeatureVector::new(vec![f2, f1]);
        assert_eq!(v_a.feature_root, v_b.feature_root, "order must not affect root");
    }

    #[test]
    fn quantize_round_half_even() {
        // 0.5 → 0 (banker's), 1.5 → 2, -0.5 → 0
        assert_eq!(quantize(0.0000005), 0);
        assert_eq!(quantize(0.0000015), 2);
        assert_eq!(quantize(-0.0000005), 0);
        assert_eq!(quantize(1.234567), 1_234_567);
    }
}

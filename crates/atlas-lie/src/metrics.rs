//! Typed `LiquidityMetrics` (directive §1.2).

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ProtocolId(pub u8);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SlippagePoint {
    /// Price impact target in bps (signed). −500 = −5%, +500 = +5%.
    pub impact_bps: i32,
    /// Output amount Q64.64 fixed-point — quantized via `quantize_q64`
    /// before this struct enters any commitment hash.
    pub out_amount_q64: u128,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LiquidityMetrics {
    pub pool: [u8; 32],
    pub protocol: ProtocolId,
    pub slot: u64,
    pub depth_minus_1pct_q64: u128,
    pub depth_plus_1pct_q64: u128,
    pub depth_minus_5pct_q64: u128,
    pub depth_plus_5pct_q64: u128,
    /// Fixed 9-point ladder per directive §1.2.
    /// Order: −5%, −2%, −1%, −0.5%, 0, +0.5%, +1%, +2%, +5%.
    pub slippage_curve: [SlippagePoint; 9],
    pub fragmentation_index_bps: u32,
    pub velocity_q64_per_slot: i128,
    pub toxicity_score_bps: u32,
    pub snapshot_hash: [u8; 32],
}

impl LiquidityMetrics {
    pub fn is_excludable_for_execution(&self) -> bool {
        self.toxicity_score_bps >= crate::toxicity::T_TOXIC_BPS
    }

    pub fn is_warn_alternative_routes(&self) -> bool {
        self.toxicity_score_bps >= crate::toxicity::T_TOXIC_WARN_BPS
    }
}

/// Round a Q64.64 value to a 1/2^32 grid (effectively half-precision)
/// before hashing — keeps the commitment stable across float pathologies
/// the off-chain ranker may have used to compute the input.
pub fn quantize_q64(x: u128) -> u128 {
    const GRID: u128 = 1u128 << 32;
    let q = x / GRID;
    let r = x % GRID;
    if r * 2 >= GRID {
        (q + 1) * GRID
    } else {
        q * GRID
    }
}

pub fn quantize_q64_signed(x: i128) -> i128 {
    let mag = quantize_q64(x.unsigned_abs());
    if x < 0 {
        -(mag as i128)
    } else {
        mag as i128
    }
}

/// Domain-tagged content-addressed hash of the metrics. Caller writes this to
/// `pool_snapshots.snapshot_hash` and to `feature_root` via the leaf hash in
/// `atlas-pipeline::hashing`.
pub fn snapshot_hash(m: &LiquidityMetrics) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.lie.metrics.v1\x00");
    h.update(&m.pool);
    h.update(&[m.protocol.0]);
    h.update(&m.slot.to_le_bytes());
    h.update(&m.depth_minus_1pct_q64.to_le_bytes());
    h.update(&m.depth_plus_1pct_q64.to_le_bytes());
    h.update(&m.depth_minus_5pct_q64.to_le_bytes());
    h.update(&m.depth_plus_5pct_q64.to_le_bytes());
    for sp in &m.slippage_curve {
        h.update(&sp.impact_bps.to_le_bytes());
        h.update(&sp.out_amount_q64.to_le_bytes());
    }
    h.update(&m.fragmentation_index_bps.to_le_bytes());
    h.update(&m.velocity_q64_per_slot.to_le_bytes());
    h.update(&m.toxicity_score_bps.to_le_bytes());
    h.finalize().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metrics(toxicity: u32) -> LiquidityMetrics {
        LiquidityMetrics {
            pool: [1u8; 32],
            protocol: ProtocolId(1),
            slot: 100,
            depth_minus_1pct_q64: 1_000_000,
            depth_plus_1pct_q64: 1_000_000,
            depth_minus_5pct_q64: 5_000_000,
            depth_plus_5pct_q64: 5_000_000,
            slippage_curve: [SlippagePoint { impact_bps: 0, out_amount_q64: 0 }; 9],
            fragmentation_index_bps: 5_000,
            velocity_q64_per_slot: 0,
            toxicity_score_bps: toxicity,
            snapshot_hash: [0u8; 32],
        }
    }

    #[test]
    fn quantize_q64_round_half_up() {
        // value = 0x1_0000_0001 (just above the grid) → quantizes down to 0x1_0000_0000
        let g = 1u128 << 32;
        assert_eq!(quantize_q64(g + 1), g);
        // value = 0x1_8000_0001 → above midpoint, quantizes up to 2g
        assert_eq!(quantize_q64(g + g / 2 + 1), 2 * g);
    }

    #[test]
    fn quantize_q64_signed_preserves_sign() {
        let g = 1i128 << 32;
        assert_eq!(quantize_q64_signed(g + 1), g);
        assert_eq!(quantize_q64_signed(-(g + 1)), -g);
    }

    #[test]
    fn exclusion_thresholds() {
        assert!(metrics(7000).is_excludable_for_execution());
        assert!(!metrics(6499).is_excludable_for_execution());
        assert!(metrics(5000).is_warn_alternative_routes());
        assert!(!metrics(3999).is_warn_alternative_routes());
    }

    #[test]
    fn snapshot_hash_deterministic() {
        let a = metrics(5000);
        let b = metrics(5000);
        assert_eq!(snapshot_hash(&a), snapshot_hash(&b));
    }

    #[test]
    fn snapshot_hash_changes_on_field_diff() {
        let a = metrics(5000);
        let mut b = metrics(5000);
        b.toxicity_score_bps = 5001;
        assert_ne!(snapshot_hash(&a), snapshot_hash(&b));
    }
}

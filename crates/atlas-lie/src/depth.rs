//! Slippage curve construction (directive §1.2).
//!
//! Builds the 9-point ladder `[-5%, -2%, -1%, -0.5%, 0, +0.5%, +1%, +2%, +5%]`
//! from a caller-provided depth lookup. The lookup is expected to come from
//! a warehouse-pinned snapshot; this module never makes a network call.

use crate::metrics::{quantize_q64, SlippagePoint};

pub const LADDER_BPS: [i32; 9] = [-500, -200, -100, -50, 0, 50, 100, 200, 500];

pub struct SlippageCurveBuilder<'a, F>
where
    F: Fn(i32) -> u128,
{
    out_amount_for_impact: &'a F,
}

impl<'a, F> SlippageCurveBuilder<'a, F>
where
    F: Fn(i32) -> u128,
{
    pub fn new(out_amount_for_impact: &'a F) -> Self {
        Self { out_amount_for_impact }
    }

    pub fn build(&self) -> [SlippagePoint; 9] {
        let mut out = [SlippagePoint { impact_bps: 0, out_amount_q64: 0 }; 9];
        for (i, impact_bps) in LADDER_BPS.iter().enumerate() {
            let raw = (self.out_amount_for_impact)(*impact_bps);
            out[i] = SlippagePoint {
                impact_bps: *impact_bps,
                out_amount_q64: quantize_q64(raw),
            };
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_9_points_in_order() {
        let f = |impact_bps: i32| -> u128 {
            // Synthetic depth: deeper impact returns more out-amount linearly.
            (1_000_000u128).saturating_add(impact_bps.unsigned_abs() as u128 * 1_000)
        };
        let b = SlippageCurveBuilder::new(&f);
        let curve = b.build();
        assert_eq!(curve.len(), 9);
        for (i, p) in curve.iter().enumerate() {
            assert_eq!(p.impact_bps, LADDER_BPS[i]);
        }
    }

    #[test]
    fn output_amounts_are_quantized() {
        let f = |_impact_bps: i32| -> u128 {
            // value just below the grid → must round down.
            (1u128 << 32) + 1
        };
        let b = SlippageCurveBuilder::new(&f);
        let curve = b.build();
        for p in curve.iter() {
            assert_eq!(p.out_amount_q64, 1u128 << 32);
        }
    }
}

//! `BacktestDataProvenance` (directive §9).
//!
//! Sandbox backtests longer than the warehouse covers can extend the
//! range with Dune SIM snapshots, but they're flagged distinctly from
//! `FullReplay` and CANNOT promote a model from `Draft → Audited`.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeterminismClass {
    /// Atlas-warehouse-only — replay-parity holds, audited promotion eligible.
    FullReplay,
    /// Dune-augmented — exploratory analysis only. Phase 06 §3.1
    /// refuses to promote on this provenance.
    DuneAugmented,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BacktestDataProvenance {
    pub atlas_warehouse_range: (u64, u64),
    pub dune_extended_range: Option<(u64, u64)>,
    pub determinism_class: DeterminismClass,
}

impl BacktestDataProvenance {
    pub fn full_replay(start: u64, end: u64) -> Self {
        Self {
            atlas_warehouse_range: (start, end),
            dune_extended_range: None,
            determinism_class: DeterminismClass::FullReplay,
        }
    }

    pub fn dune_augmented(
        warehouse: (u64, u64),
        dune_extension: (u64, u64),
    ) -> Self {
        Self {
            atlas_warehouse_range: warehouse,
            dune_extended_range: Some(dune_extension),
            determinism_class: DeterminismClass::DuneAugmented,
        }
    }

    /// Phase 06 §3.1 promotion gate: only `FullReplay` provenance
    /// can promote a model from `Draft` to `Audited`.
    pub fn audited_promotion_eligible(&self) -> bool {
        self.determinism_class == DeterminismClass::FullReplay
            && self.dune_extended_range.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_replay_promotion_eligible() {
        let p = BacktestDataProvenance::full_replay(0, 1_000);
        assert!(p.audited_promotion_eligible());
    }

    #[test]
    fn dune_augmented_blocks_promotion() {
        let p = BacktestDataProvenance::dune_augmented((0, 1_000), (1_000, 2_000));
        assert!(!p.audited_promotion_eligible());
    }

    #[test]
    fn full_replay_with_extension_blocks_promotion() {
        // Defensive: even if someone manually sets FullReplay with a
        // dune extension range, the gate still rejects.
        let mut p = BacktestDataProvenance::full_replay(0, 1_000);
        p.dune_extended_range = Some((1_000, 2_000));
        assert!(!p.audited_promotion_eligible());
    }
}

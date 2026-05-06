//! Source markers — directive §1.5 + §4 anti-pattern enforcement.
//!
//! Anti-pattern §4: *"Quoting Jupiter live during stage 03. Quotes go through
//! the warehouse-pinned snapshot path."*
//!
//! Enforcement at the type level: only values implementing
//! `WarehousePinnedSource` may enter the commitment-bound LIE path. Live
//! Jupiter or Birdeye quotes can still be obtained for monitoring, but they
//! land in the explicitly-non-commitment `LiveQuote*` types which do **not**
//! implement the marker trait.

/// Marker — value was sourced from a warehouse-pinned snapshot at the given
/// slot. Only inputs satisfying this trait are accepted by the commitment
/// path of the LIE.
pub trait WarehousePinnedSource {
    fn pinned_slot(&self) -> u64;
}

/// Snapshot reference returned by the warehouse client. The commitment-bound
/// LIE path takes this directly.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WarehouseSnapshotRef {
    pub pinned_slot: u64,
    pub snapshot_hash: [u8; 32],
}

impl WarehousePinnedSource for WarehouseSnapshotRef {
    fn pinned_slot(&self) -> u64 {
        self.pinned_slot
    }
}

/// Live Jupiter quote — explicitly NOT a `WarehousePinnedSource`. Use only
/// for monitoring / dashboards. Cannot enter a commitment input.
#[derive(Clone, Copy, Debug)]
pub struct LiveJupiterQuote {
    pub out_amount_q64: u128,
    pub queried_at_slot: u64,
}

/// Live Birdeye depth — explicitly NOT a `WarehousePinnedSource`.
#[derive(Clone, Copy, Debug)]
pub struct LiveBirdeyeDepth {
    pub depth_q64: u128,
    pub queried_at_slot: u64,
}

/// Pure helper used by the commitment path to assert at compile time that
/// it received a warehouse-pinned input. Phase 4 wires this into the
/// `LiquidityMetrics` builder when the live transports land.
pub fn require_pinned<S: WarehousePinnedSource>(s: &S) -> u64 {
    s.pinned_slot()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn warehouse_snapshot_implements_marker() {
        let s = WarehouseSnapshotRef { pinned_slot: 100, snapshot_hash: [0u8; 32] };
        assert_eq!(require_pinned(&s), 100);
    }

    #[test]
    fn live_quote_does_not_implement_marker() {
        // Compile-time enforcement: this MUST NOT compile if you uncomment:
        //
        //     let live = LiveJupiterQuote { out_amount_q64: 1, queried_at_slot: 100 };
        //     require_pinned(&live);
        //
        // The trait bound rejects it. Documented here as the intended barrier.
        let live = LiveJupiterQuote { out_amount_q64: 1, queried_at_slot: 100 };
        let _ = live; // value exists, but cannot enter commitment path.
    }
}

//! Signal-to-rebalance attribution view (directive §3.3).

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignalToRebalance {
    pub signal_id: [u8; 32],
    pub signal_kind: String,
    pub signal_slot: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttributionRow {
    pub rebalance_public_input_hash: [u8; 32],
    pub rebalance_slot: u64,
    /// Signals fired in the K-slot window before this rebalance.
    pub preceding_signals: Vec<SignalToRebalance>,
    /// Slot lag between earliest preceding signal and the rebalance.
    pub earliest_lag_slots: u64,
}

/// Build attribution rows by joining each rebalance to forensic
/// signals that fired in the prior `window_slots`.
pub fn attribution_join(
    rebalances: &[(u64, [u8; 32])],
    signals: &[SignalToRebalance],
    window_slots: u64,
) -> Vec<AttributionRow> {
    let mut sigs = signals.to_vec();
    sigs.sort_by_key(|s| s.signal_slot);
    let mut out = Vec::with_capacity(rebalances.len());
    for (slot, hash) in rebalances {
        let lo = slot.saturating_sub(window_slots);
        let preceding: Vec<SignalToRebalance> = sigs
            .iter()
            .filter(|s| s.signal_slot >= lo && s.signal_slot < *slot)
            .cloned()
            .collect();
        let earliest_lag_slots = preceding
            .first()
            .map(|s| slot.saturating_sub(s.signal_slot))
            .unwrap_or(0);
        out.push(AttributionRow {
            rebalance_public_input_hash: *hash,
            rebalance_slot: *slot,
            preceding_signals: preceding,
            earliest_lag_slots,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sig(slot: u64, kind: &str, byte: u8) -> SignalToRebalance {
        SignalToRebalance {
            signal_id: [byte; 32],
            signal_kind: kind.into(),
            signal_slot: slot,
        }
    }

    #[test]
    fn joins_preceding_signals_in_window() {
        let rebal = vec![(110u64, [1u8; 32])];
        let signals = vec![
            sig(80, "LargeStableExit", 1),
            sig(95, "AbnormalWithdrawal", 2),
            sig(120, "LiquidationCascade", 3), // after rebalance, excluded
        ];
        // window=30 → looks back to slot 80 inclusive. Both 80 and 95
        // are in window; 120 is past the rebalance slot.
        let rows = attribution_join(&rebal, &signals, 30);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].preceding_signals.len(), 2);
        assert_eq!(rows[0].preceding_signals[0].signal_kind, "LargeStableExit");
        // Earliest lag: 110 - 80 = 30 slots.
        assert_eq!(rows[0].earliest_lag_slots, 30);
    }

    #[test]
    fn no_preceding_signals_yields_zero_lag() {
        let rebal = vec![(100u64, [1u8; 32])];
        let signals = vec![sig(150, "X", 1)]; // after the rebalance
        let rows = attribution_join(&rebal, &signals, 50);
        assert_eq!(rows[0].earliest_lag_slots, 0);
        assert!(rows[0].preceding_signals.is_empty());
    }
}

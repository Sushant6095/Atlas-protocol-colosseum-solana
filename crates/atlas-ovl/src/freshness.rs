//! Freshness gates (directive §2.3).

pub const MAX_PYTH_LAG_SLOTS: u64 = 25;
pub const MAX_SB_LAG_SLOTS: u64 = 30;

pub fn is_stale_pyth(current_slot: u64, publish_slot: u64) -> bool {
    current_slot.saturating_sub(publish_slot) > MAX_PYTH_LAG_SLOTS
}

pub fn is_stale_switchboard(current_slot: u64, publish_slot: u64) -> bool {
    current_slot.saturating_sub(publish_slot) > MAX_SB_LAG_SLOTS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pyth_boundary() {
        // Lag of exactly MAX is NOT stale; lag of MAX + 1 is stale.
        assert!(!is_stale_pyth(125, 100));
        assert!(is_stale_pyth(126, 100));
    }

    #[test]
    fn switchboard_boundary() {
        assert!(!is_stale_switchboard(130, 100));
        assert!(is_stale_switchboard(131, 100));
    }
}

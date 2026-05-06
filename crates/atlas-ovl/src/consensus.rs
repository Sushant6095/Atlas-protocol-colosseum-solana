//! Per-asset oracle consensus + deviation classification (directive §2.2).

use crate::freshness::{is_stale_pyth, is_stale_switchboard};
use serde::{Deserialize, Serialize};

pub const DEVIATION_BAND_NORMAL_BPS: u32 = 30;
pub const DEVIATION_BAND_DEGRADED_BPS: u32 = 80;
pub const DEVIATION_BAND_FALLBACK_BPS: u32 = 200;
pub const PYTH_CONF_FALLBACK_MAX_BPS: u32 = 50;
pub const TWAP_MIN_SAMPLE_COUNT: u32 = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct OracleFlags(pub u8);

impl OracleFlags {
    pub const STALE_PYTH: u8 = 1 << 0;
    pub const STALE_SB: u8 = 1 << 1;
    pub const TWAP_DIVERGE: u8 = 1 << 2;
    pub const CEX_DIVERGE: u8 = 1 << 3;
    pub const LOW_CONFIDENCE: u8 = 1 << 4;
    pub const DEFENSIVE_TRIGGER: u8 = 1 << 5;

    pub fn set(&mut self, flag: u8) {
        self.0 |= flag;
    }

    pub fn has(&self, flag: u8) -> bool {
        self.0 & flag != 0
    }
}

#[derive(Clone, Copy, Debug)]
pub struct ConsensusInput {
    pub asset: u32,
    pub current_slot: u64,
    pub pyth_price_q64: i64,
    pub pyth_conf_q64: u64,
    pub pyth_publish_slot: u64,
    pub sb_price_q64: i64,
    pub sb_publish_slot: u64,
    pub twap_5m_q64: i64,
    pub twap_5m_sample_count: u32,
    pub twap_30m_q64: i64,
    pub twap_30m_sample_count: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct OracleConsensus {
    pub asset: u32,
    pub slot: u64,
    pub pyth_price_q64: i64,
    pub pyth_conf_q64: u64,
    pub pyth_publish_slot: u64,
    pub sb_price_q64: i64,
    pub sb_publish_slot: u64,
    pub twap_5m_q64: i64,
    pub twap_30m_q64: i64,
    pub consensus_price_q64: i64,
    pub max_pairwise_deviation_bps: u32,
    pub confidence_bps: u32,
    pub flags: OracleFlags,
    pub defensive_mode: bool,
}

/// Run the directive §2.2 selection algorithm. Pure function — testable
/// without network. Caller is expected to populate `ConsensusInput` from
/// warehouse-pinned snapshots in the commitment path.
pub fn derive_consensus(input: ConsensusInput) -> OracleConsensus {
    let mut flags = OracleFlags::default();
    let stale_pyth = is_stale_pyth(input.current_slot, input.pyth_publish_slot);
    let stale_sb = is_stale_switchboard(input.current_slot, input.sb_publish_slot);
    let low_twap = input.twap_5m_sample_count < TWAP_MIN_SAMPLE_COUNT;
    if stale_pyth {
        flags.set(OracleFlags::STALE_PYTH);
    }
    if stale_sb {
        flags.set(OracleFlags::STALE_SB);
    }
    if low_twap {
        flags.set(OracleFlags::LOW_CONFIDENCE);
    }

    let pyth = input.pyth_price_q64;
    let sb = input.sb_price_q64;
    let twap5 = input.twap_5m_q64;

    let dev_pyth_sb = deviation_bps(pyth, sb);
    let dev_pyth_twap = deviation_bps(pyth, twap5);
    let dev_sb_twap = deviation_bps(sb, twap5);
    let max_pairwise = dev_pyth_sb.max(dev_pyth_twap).max(dev_sb_twap);

    // §2.2 rules.
    let any_stale_or_low = stale_pyth || stale_sb || low_twap;

    let (consensus_price, confidence_bps, defensive_mode) =
        if max_pairwise > DEVIATION_BAND_FALLBACK_BPS || any_stale_or_low {
            // > 200 bps OR any feed stale → defensive.
            flags.set(OracleFlags::DEFENSIVE_TRIGGER);
            if max_pairwise > DEVIATION_BAND_FALLBACK_BPS {
                flags.set(OracleFlags::TWAP_DIVERGE);
            }
            (pyth, 0, true)
        } else if max_pairwise <= DEVIATION_BAND_NORMAL_BPS {
            // ≤ 30 bps and not stale → median, conf 9_500.
            (median3(pyth, sb, twap5), 9_500, false)
        } else if max_pairwise <= DEVIATION_BAND_DEGRADED_BPS {
            // 30..=80 bps → median, confidence linear-degraded to 7_000.
            // Linear: dev=30→9_500, dev=80→7_000.
            let span = (DEVIATION_BAND_DEGRADED_BPS - DEVIATION_BAND_NORMAL_BPS) as i64;
            let drop_from_top = (max_pairwise as i64 - DEVIATION_BAND_NORMAL_BPS as i64).max(0);
            let confidence = 9_500u32 - ((2_500i64 * drop_from_top) / span.max(1)) as u32;
            (median3(pyth, sb, twap5), confidence, false)
        } else {
            // 80..=200 bps → flag TWAP_DIVERGE; fall back to Pyth if conf < 50 bps.
            flags.set(OracleFlags::TWAP_DIVERGE);
            let pyth_conf_bps = if pyth.unsigned_abs() == 0 {
                u32::MAX
            } else {
                ((input.pyth_conf_q64 as u128 * 10_000) / pyth.unsigned_abs() as u128).min(u32::MAX as u128)
                    as u32
            };
            if pyth_conf_bps <= PYTH_CONF_FALLBACK_MAX_BPS {
                (pyth, 5_000, false)
            } else {
                flags.set(OracleFlags::DEFENSIVE_TRIGGER);
                (pyth, 0, true)
            }
        };

    OracleConsensus {
        asset: input.asset,
        slot: input.current_slot,
        pyth_price_q64: input.pyth_price_q64,
        pyth_conf_q64: input.pyth_conf_q64,
        pyth_publish_slot: input.pyth_publish_slot,
        sb_price_q64: input.sb_price_q64,
        sb_publish_slot: input.sb_publish_slot,
        twap_5m_q64: input.twap_5m_q64,
        twap_30m_q64: input.twap_30m_q64,
        consensus_price_q64: consensus_price,
        max_pairwise_deviation_bps: max_pairwise,
        confidence_bps,
        flags,
        defensive_mode,
    }
}

fn deviation_bps(a: i64, b: i64) -> u32 {
    let denom = (a.unsigned_abs().max(b.unsigned_abs()).max(1)) as u128;
    let diff = (a - b).unsigned_abs() as u128;
    ((diff * 10_000) / denom).min(u32::MAX as u128) as u32
}

fn median3(a: i64, b: i64, c: i64) -> i64 {
    let mut v = [a, b, c];
    v.sort();
    v[1]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(pyth: i64, sb: i64, twap: i64, current_slot: u64, publish_slot: u64) -> ConsensusInput {
        ConsensusInput {
            asset: 1,
            current_slot,
            pyth_price_q64: pyth,
            pyth_conf_q64: 1_000,
            pyth_publish_slot: publish_slot,
            sb_price_q64: sb,
            sb_publish_slot: publish_slot,
            twap_5m_q64: twap,
            twap_5m_sample_count: 64,
            twap_30m_q64: twap,
            twap_30m_sample_count: 64,
        }
    }

    #[test]
    fn within_30_bps_is_full_confidence() {
        // Three feeds at exactly the same price.
        let c = derive_consensus(input(1_000_000, 1_000_000, 1_000_000, 100, 100));
        assert_eq!(c.confidence_bps, 9_500);
        assert!(!c.defensive_mode);
        assert_eq!(c.max_pairwise_deviation_bps, 0);
    }

    #[test]
    fn dev_50_bps_degrades_confidence() {
        // Pyth at 1_000_000, sb at 1_005_000 → 50 bps deviation.
        let c = derive_consensus(input(1_000_000, 1_005_000, 1_000_000, 100, 100));
        assert!(c.confidence_bps >= 7_000 && c.confidence_bps < 9_500);
        assert!(!c.defensive_mode);
    }

    #[test]
    fn dev_100_bps_falls_back_to_pyth() {
        // Sb is 1_010_000 (100 bps from pyth), pyth conf is tight.
        let mut i = input(1_000_000, 1_010_000, 1_000_000, 100, 100);
        i.pyth_conf_q64 = 30; // ~3 bps confidence — well below fallback ceiling.
        let c = derive_consensus(i);
        assert!(c.flags.has(OracleFlags::TWAP_DIVERGE));
        assert_eq!(c.consensus_price_q64, 1_000_000);
        assert_eq!(c.confidence_bps, 5_000);
        assert!(!c.defensive_mode);
    }

    #[test]
    fn dev_100_bps_with_loose_pyth_conf_triggers_defensive() {
        let mut i = input(1_000_000, 1_010_000, 1_000_000, 100, 100);
        i.pyth_conf_q64 = 10_000; // 100 bps confidence — loose.
        let c = derive_consensus(i);
        assert!(c.defensive_mode);
        assert!(c.flags.has(OracleFlags::DEFENSIVE_TRIGGER));
    }

    #[test]
    fn dev_250_bps_triggers_defensive() {
        let c = derive_consensus(input(1_000_000, 1_025_000, 1_000_000, 100, 100));
        assert!(c.defensive_mode);
        assert!(c.flags.has(OracleFlags::DEFENSIVE_TRIGGER));
    }

    #[test]
    fn stale_pyth_triggers_defensive_even_at_zero_deviation() {
        let i = input(1_000_000, 1_000_000, 1_000_000, 200, 100);
        let c = derive_consensus(i);
        assert!(c.flags.has(OracleFlags::STALE_PYTH));
        assert!(c.defensive_mode);
    }

    #[test]
    fn low_twap_sample_count_triggers_defensive() {
        let mut i = input(1_000_000, 1_000_000, 1_000_000, 100, 100);
        i.twap_5m_sample_count = 1;
        let c = derive_consensus(i);
        assert!(c.flags.has(OracleFlags::LOW_CONFIDENCE));
        assert!(c.defensive_mode);
    }

    #[test]
    fn deviation_calculation_symmetric() {
        let a = deviation_bps(1_000_000, 1_010_000);
        let b = deviation_bps(1_010_000, 1_000_000);
        assert_eq!(a, b);
    }

    #[test]
    fn median3_returns_middle() {
        assert_eq!(median3(1, 2, 3), 2);
        assert_eq!(median3(3, 1, 2), 2);
        assert_eq!(median3(2, 2, 2), 2);
    }
}

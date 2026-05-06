//! 1232-byte transaction envelope + per-bundle size budget (directive §2).

use serde::{Deserialize, Serialize};

/// Solana mainnet transaction packet limit.
pub const TX_SIZE_LIMIT: usize = 1232;
/// Operational budget — transactions are flagged when they exceed this so
/// the bundle composer can reroute before hitting the hard packet cap.
pub const TX_SIZE_BUDGET_BYTES: usize = 1180;
/// Per-bundle transaction count cap.
pub const MAX_TX_PER_BUNDLE: usize = 5;
/// Per-tx ALT count: 1..=4 declared lookup tables (§2.1).
pub const ALTS_PER_TX_RANGE: std::ops::RangeInclusive<usize> = 1..=4;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BundleSizeError {
    #[error("transaction {index} is {bytes} bytes; exceeds 1232-byte packet limit")]
    TxTooLarge { index: usize, bytes: usize },
    #[error("bundle holds {count} transactions; exceeds the 5-tx limit")]
    TooManyTxs { count: usize },
    #[error("transaction {index} declares {alts} ALTs; must be in 1..=4")]
    BadAltCount { index: usize, alts: usize },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BundleTx {
    pub bytes: usize,
    pub alt_count: usize,
}

pub fn validate_bundle(txs: &[BundleTx]) -> Result<(), BundleSizeError> {
    if txs.len() > MAX_TX_PER_BUNDLE {
        return Err(BundleSizeError::TooManyTxs { count: txs.len() });
    }
    for (i, t) in txs.iter().enumerate() {
        if t.bytes > TX_SIZE_LIMIT {
            return Err(BundleSizeError::TxTooLarge { index: i, bytes: t.bytes });
        }
        if !ALTS_PER_TX_RANGE.contains(&t.alt_count) {
            return Err(BundleSizeError::BadAltCount { index: i, alts: t.alt_count });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tx(b: usize, a: usize) -> BundleTx { BundleTx { bytes: b, alt_count: a } }

    #[test]
    fn happy_path_validates() {
        let bundle = vec![tx(900, 1), tx(1100, 2), tx(1232, 4)];
        validate_bundle(&bundle).unwrap();
    }

    #[test]
    fn too_large_rejects() {
        let bundle = vec![tx(1233, 1)];
        assert!(matches!(
            validate_bundle(&bundle),
            Err(BundleSizeError::TxTooLarge { .. })
        ));
    }

    #[test]
    fn too_many_txs_rejects() {
        let bundle = vec![tx(900, 1); 6];
        assert!(matches!(
            validate_bundle(&bundle),
            Err(BundleSizeError::TooManyTxs { count: 6 })
        ));
    }

    #[test]
    fn alt_count_outside_range_rejects() {
        let bundle = vec![tx(900, 0)];
        assert!(matches!(
            validate_bundle(&bundle),
            Err(BundleSizeError::BadAltCount { index: 0, alts: 0 })
        ));
        let bundle = vec![tx(900, 5)];
        assert!(matches!(
            validate_bundle(&bundle),
            Err(BundleSizeError::BadAltCount { index: 0, alts: 5 })
        ));
    }

    #[test]
    fn budget_is_below_hard_limit() {
        // The §10 SLO is `tx_size_bytes_p99 ≤ 1180` → operational budget;
        // hard cap is 1232. Test the constants are sane.
        assert!(TX_SIZE_BUDGET_BYTES < TX_SIZE_LIMIT);
    }
}

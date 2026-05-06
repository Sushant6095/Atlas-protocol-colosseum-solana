//! CEX reference sanity-guard (directive §2.1 + §4 anti-pattern).
//!
//! Anti-pattern §4: *"Using Birdeye CEX prices in a commitment input. Sanity
//! guards only."*
//!
//! `CexReference` deliberately does not implement `Serialize`, does not
//! expose a 32-byte commitment hash, and does not implement
//! `WarehousePinnedSource`. The only operation it offers is a sanity check
//! that flips a flag on the consensus output (`CEX_DIVERGE`) without changing
//! the commitment-bound `consensus_price_q64`.

#[derive(Clone, Copy, Debug)]
pub struct CexReference {
    pub price_q64: i64,
    pub queried_at_unix_secs: u64,
    pub source: &'static str,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, thiserror::Error)]
pub enum CexDivergence {
    #[error("cex price diverges by {bps} bps from on-chain consensus (band {band})")]
    AboveBand { bps: u32, band: u32 },
}

impl CexReference {
    /// Sanity check — returns `Ok(())` when CEX price agrees within
    /// `band_bps`. The consensus path turns `Err` into the `CEX_DIVERGE`
    /// flag without altering `consensus_price_q64`. CEX prices NEVER enter
    /// the commitment input.
    pub fn agrees_with(&self, consensus_q64: i64, band_bps: u32) -> Result<(), CexDivergence> {
        let denom = consensus_q64.unsigned_abs().max(1) as u128;
        let diff = (self.price_q64 - consensus_q64).unsigned_abs() as u128;
        let bps = ((diff * 10_000) / denom).min(u32::MAX as u128) as u32;
        if bps > band_bps {
            Err(CexDivergence::AboveBand { bps, band: band_bps })
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agrees_within_band_returns_ok() {
        let r = CexReference {
            price_q64: 1_000_000,
            queried_at_unix_secs: 0,
            source: "birdeye",
        };
        // Consensus price 1_001_000 → 10 bps off; band 50 bps allows it.
        assert!(r.agrees_with(1_001_000, 50).is_ok());
    }

    #[test]
    fn diverges_above_band_returns_err() {
        let r = CexReference {
            price_q64: 1_000_000,
            queried_at_unix_secs: 0,
            source: "birdeye",
        };
        let err = r.agrees_with(1_100_000, 50).unwrap_err();
        match err {
            CexDivergence::AboveBand { bps, band } => {
                assert!(bps > band);
            }
        }
    }

    /// Compile-time enforcement: `CexReference` exposes no commitment hash.
    /// This test exists only to document the contract — the absence of a
    /// `commitment_hash() -> [u8; 32]` method is the enforcement.
    #[test]
    fn cex_reference_has_no_commitment_hash() {
        let _r = CexReference {
            price_q64: 0,
            queried_at_unix_secs: 0,
            source: "birdeye",
        };
        // (no `_r.commitment_hash()` call exists — the method is intentionally absent.)
    }
}

//! atlas-ovl — Oracle Validation Layer.
//!
//! Implements directive 04 §2. Consumes Pyth + Switchboard + DEX-TWAP and
//! emits a typed `OracleConsensus` per asset per slot, with explicit
//! deviation telemetry and a defensive-mode trigger if the price surface
//! cannot be cross-validated.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod consensus;
pub mod freshness;
pub mod keeper;

pub use consensus::{
    derive_consensus, ConsensusInput, OracleConsensus, OracleFlags,
    DEVIATION_BAND_NORMAL_BPS, DEVIATION_BAND_DEGRADED_BPS, DEVIATION_BAND_FALLBACK_BPS,
    PYTH_CONF_FALLBACK_MAX_BPS,
};
pub use freshness::{is_stale_pyth, is_stale_switchboard, MAX_PYTH_LAG_SLOTS, MAX_SB_LAG_SLOTS};
pub use keeper::{PostedPriceUpdate, PullOracleKeeper, PullOraclePostError, MAX_PRICE_UPDATE_LAG};

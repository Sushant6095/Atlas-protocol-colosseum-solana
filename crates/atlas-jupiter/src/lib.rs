//! atlas-jupiter — Jupiter Lend + Perps composition (directive §5 + §6).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod hedge;
pub mod lend;
pub mod programs;

pub use hedge::{
    compute_hedge_sizing, validate_hedge_request, HedgeError, HedgePolicy, HedgeRequest,
    HedgeSizing,
};
pub use lend::{LendPosition, LendVenue};
pub use programs::{JupiterProgram, JUPITER_PROGRAM_IDS};

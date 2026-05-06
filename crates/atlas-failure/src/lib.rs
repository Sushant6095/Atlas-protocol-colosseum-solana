//! atlas-failure — typed failure classification + remediation map.
//!
//! Implements directive 05 §2. Every error in commitment paths classifies
//! into a `FailureClass` variant; every variant maps to a `Remediation`
//! action. Untyped `anyhow::Error` is banned.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod class;
pub mod remediation;
pub mod log;

pub use class::{
    AgentId, AssetId, FailureClass, FeedId, ProtocolId, Pubkey, RejectionCode, SourceId,
    VariantTag,
};
pub use remediation::{remediation_for, Remediation, RemediationId};
pub use log::{FailureLogEntry, message_hash};

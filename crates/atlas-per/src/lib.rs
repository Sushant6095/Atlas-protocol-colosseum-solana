//! atlas-per — Private Execution Layer (directive 18).
//!
//! Phase 14 (Cloak) hides amounts. Phase 18 (this crate) hides the
//! execution path. Together they form the institutional-privacy
//! bundle: amounts confidential, routing private, settlement
//! publicly verifiable.
//!
//! Hard rules (extend Phase 01):
//!
//! - **I-22** Private execution preserves on-chain settlement
//!   guarantees. A rebalance executed inside a PER session must
//!   settle back to mainnet within `MAX_PER_SESSION_SLOTS`. Beyond
//!   that, the gateway auto-undelegates and reclaims state via the
//!   rollup's safety primitive.
//! - **I-23** Verifier accepts only ER-rooted state transitions.
//!   The proof commits to `(pre_state_commitment,
//!   post_state_commitment, er_session_id, er_state_root)`; the
//!   verifier asserts the post-state matches the un-delegated
//!   mainnet state byte-for-byte after settlement.
//! - **I-24** Private mode is per-vault and lifelong. The choice
//!   is part of the strategy commitment hash; no mid-life flip.
//! - **I-25** No private execution without disclosure policy. A
//!   `PrivateER` vault must declare a `DisclosurePolicy` with
//!   ExecutionPath* scope coverage; CI invariant enforces this.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod execution_privacy;
pub mod gateway;
pub mod public_input_v4;
pub mod session;
pub mod settlement;

pub use execution_privacy::{
    require_execution_path_scope, ExecutionPrivacy, ExecutionPrivacyError,
    MAX_PER_SESSION_SLOTS,
};
pub use gateway::{
    derive_session_id, GatewayError, GatewayEvent, PerGateway, SessionStatus,
};
pub use public_input_v4::{
    encode_v4, PrivateExecutionFlags, PublicInputV4, V4_FLAG_CONFIDENTIAL_MODE,
    V4_FLAG_PRIVATE_EXECUTION, V4_TOTAL_BYTES, V4_VERSION_TAG,
};
pub use session::{ErSession, SessionOpenError};
pub use settlement::{
    verify_settlement, SettlementError, SettlementPayload, SettlementVerdict,
};

//! atlas-operator-agent — scoped keepers with on-chain mandates +
//! independent execution-time attestations (directive 15).
//!
//! Tier 3 phase: this layer does not redefine Atlas. It adds the
//! institutional-trust improvements:
//!
//! 1. **Scoped keeper authority** (I-18) — distinct on-chain keys
//!    per duty (rebalance, settlement, alt, archive, hedge, pyth-post,
//!    attestation). Cross-class signing rejected by program.
//! 2. **Mandate expiry + ratcheting** (I-19) — every keeper carries a
//!    `valid_until_slot` + `max_actions` + `max_notional_total_q64`,
//!    ratcheted on use; renewal goes through multisig.
//! 3. **Independent execution checks** (I-20) — high-impact actions
//!    require both the proof gate AND a separate
//!    `ExecutionAttestation` produced by the `attestation_keeper`.
//! 4. **No silent scope expansion** (I-21) — adding a new action
//!    class to a mandate is a multisig event, not a config edit.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod agents;
pub mod attestation;
pub mod mandate;
pub mod pending;
pub mod registry;
pub mod role;

pub use agents::{render_agent_card, AgentCard, AgentReality};
pub use attestation::{
    attest_freshness, ExecutionAttestation, AttestationError, AttestationKind,
    MAX_ATTESTATION_STALENESS_SLOTS,
};
pub use mandate::{
    KeeperMandate, MandateError, MandateUsage, MAX_NOTIONAL_UNLIMITED,
};
pub use pending::{
    enqueue_pending, PendingBundle, PendingBundleError, PendingDecision,
    PendingPriority,
};
pub use registry::{
    KeeperRegistry, RegistryError,
};
pub use role::{
    action_bit, ActionBitset, ActionClass, KeeperRole, RoleAuthorizationError,
};

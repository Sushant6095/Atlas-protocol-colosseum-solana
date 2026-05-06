//! atlas-rpc-router — latency-tiered routing + slot-drift attribution
//! + slot-freshness budget (directive 17).
//!
//! Phase 02 already gives us multi-RPC quorum, hot/warm/cold failover,
//! reliability EMA, and quarantine. Phase 17 layers the explicit
//! split between *latency-optimised* and *consistency-optimised* read
//! paths, attributes which RPC caused a quorum disagreement, and
//! exposes the slot-freshness window as a glanceable surface.
//!
//! Hard rules:
//!
//! 1. `read_hot` is single-source by design. Calling code accepts
//!    eventual cross-validation; downstream commitment-path code
//!    re-validates against quorum. The runtime lint
//!    `lint_no_read_hot_in_commitment_path` blocks misuse.
//! 2. A `tier_a_latency` source does NOT count toward the
//!    `min_sources` quorum minimum unless it also carries the
//!    `tier_b_quorum` tag and meets the geographic-diversity guard.
//! 3. Slot-drift attribution requires quorum context. A single
//!    anomalous response is a soft fault; a sustained outlier share
//!    above `OUTLIER_QUARANTINE_BPS` triggers Phase 02 quarantine.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod attribution;
pub mod freshness;
pub mod role;
pub mod router;

pub use attribution::{
    AttributionEngine, AttributionEntry, AttributionVerdict, DisagreementKind,
    OUTLIER_QUARANTINE_BPS,
};
pub use freshness::{
    freshness_band, FreshnessBand, FreshnessBudget, ProofPipelineStage,
    ProofPipelineTimeline, MAX_STALE_SLOTS,
};
pub use role::{
    canonical_role_for, RoleAssignment, RpcRole, RpcRoleSet, RpcRoleSetError,
    SourceManifest,
};
pub use router::{
    AccountRead, AccountResult, ArchiveRead, HotReadError, QuorumPath, ReadClass,
    RouteDecision, RouterError, RpcRouter,
};

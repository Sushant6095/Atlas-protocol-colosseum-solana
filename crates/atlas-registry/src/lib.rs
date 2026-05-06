//! atlas-registry — model registry + lineage + governance (directive 06 §2).
//!
//! Source of truth for every model that has ever existed in Atlas, approved
//! or not. The registry's authoritative state can be reconstructed from
//! Bubblegum-anchored status transitions plus content-addressed artifacts
//! (directive §3.2).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod anchor;
pub mod drift;
pub mod feature_schema;
pub mod lineage;
pub mod record;
pub mod store;

pub use anchor::{anchor_leaf, RegistryAnchor};
pub use drift::{
    brier_score_bps, mae_bps, DefensiveBaseline, DriftAlert, DriftReport, DriftThresholds,
};
pub use feature_schema::{verify_feature_schema, FeatureSchema, FeatureSchemaError};
pub use lineage::{validate_lineage, LineageError};
pub use record::{
    AuditEntry, AuditVerdict, ModelId, ModelRecord, ModelStatus, RecordValidationError,
};
pub use store::{InMemoryRegistry, ModelRegistry};

//! atlas-payments — Atlas Treasury OS for internet businesses
//! (directive 13).
//!
//! **Hard rule (§1):** Dodo API output never enters a Poseidon
//! commitment path. Payment schedules, invoices, KYB attestations,
//! runway forecasts are *scheduling metadata* — they trigger pipeline
//! runs, they are never inputs to the proof. Phase 09's
//! `forbid_third_party_in_commitment` lint extension rejects any
//! Dodo type referenced from canonical commitment-path source files.
//!
//! Six modules:
//!
//! * `business`    — `BusinessTreasury` extending `TreasuryEntity`
//!                   with KYB hash, payment account id, and a
//!                   role-bound `SignerRoster`.
//! * `dodo`        — webhook payload schema + HMAC verification +
//!                   replay protection on `intent_id`.
//! * `prewarm`     — payment buffer engine: schedule → ratcheted
//!                   buffer + split/defer/alert resolver.
//! * `runway`      — cashflow forecasting (p10 / p50 percentile
//!                   runway days) constrained to *tighten* allocation,
//!                   never loosen.
//! * `invoice`     — invoice intelligence: open AR + expected
//!                   settlement distribution.
//! * `kyb`         — KYB attestation hash committed at creation.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod auto_deposit;
pub mod business;
pub mod compliance;
pub mod dodo;
pub mod invoice;
pub mod kyb;
pub mod prewarm;
pub mod runway;
pub mod settlement_route;
pub mod warehouse_schema;

pub use auto_deposit::{
    decide_auto_deposit, AutoDepositDecision, AutoDepositDeferralReason, AutoDepositError,
    AutoDepositPolicy, InvoiceSettledEvent,
};
pub use compliance::{
    compliance_preflight, AmlReadGrant, AmlReadScope, ComplianceCheckError,
    CompliancePolicyError, RegionPolicy, SanctionsScreening,
};
pub use settlement_route::{
    pick_settlement, DodoSettlementRoute, MultiStableSettlementOptions, PaymentIntent,
    PickedSettlement, SettlementQuote, SettlementReceipt, SettlementRoute, SettlementRouteId,
    SettlementSelectError,
};
pub use warehouse_schema::{
    compute_payment_id, compute_recipient_ref_hash, InvoiceRow, PaymentRow, PaymentStatus,
    SettlementRouteTag,
};
pub use business::{
    business_commitment_hash, BusinessKind, BusinessTreasury, BusinessTreasuryError, Role,
    SignerRoster, SignerRosterEntry,
};
pub use dodo::{
    verify_dodo_signature, DodoIntent, DodoPaymentSchedule, DodoSignatureError,
    DodoWebhookPayload, IntentDedup, IntentDedupError, PriorityClass,
    MAX_WEBHOOK_AGE_SECONDS,
};
pub use invoice::{
    InvoiceIntelligence, InvoiceLedger, InvoiceRecord, InvoiceStatus, SettlementDistribution,
};
pub use kyb::{kyb_commitment_hash, KybAttestation, KybProviderId};
pub use prewarm::{
    plan_prewarm, PreWarmDecision, PreWarmError, PreWarmPolicy, PreWarmedScheduleEntry,
};
pub use runway::{
    forecast_runway, runway_constraint, RunwayConstraintTier, RunwayForecast, RunwayInputs,
};

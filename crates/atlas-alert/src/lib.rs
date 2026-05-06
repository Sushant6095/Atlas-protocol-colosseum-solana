//! atlas-alert — autonomous alert engine (directive 05 §4).
//!
//! Three classes:
//! * **Page**  — wakes oncall (PagerDuty / Opsgenie). Reserved for archival
//!   failure, hard quorum disagreement, post-condition violation, prover
//!   network down, and security events.
//! * **Notify** — Slack / Discord channel. For degraded mode entered,
//!   defensive rebalance, oracle deviation, consensus disagreement spike,
//!   and source quarantine.
//! * **Digest** — daily summary.
//!
//! Suppression / dedup (directive §4.2):
//! * Same `(class, vault_id)` within 60 s collapses into one alert with
//!   a count. Counter is exposed in the rendered narrative as `[xN]`.
//! * Auto-resolve when the underlying condition clears for K=8 consecutive
//!   slots (see [`AlertEngine::observe_clear`]).
//! * Maintenance windows (set via `atlas-alertctl maintenance ...`) suppress
//!   non-security pages; security pages always fire.
//!
//! Narratives are templates only — no free-form strings (anti-pattern §7).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod kind;
pub mod render;
pub mod sink;
pub mod engine;

pub use engine::{AlertEngine, MaintenanceWindow, SuppressionConfig};
pub use kind::{Alert, AlertClass, AlertKind};
pub use render::{render_alert, RenderError, TemplateField};
pub use sink::{AlertDispatcher, AlertSink, NoopSink, RecordingSink, SinkError};

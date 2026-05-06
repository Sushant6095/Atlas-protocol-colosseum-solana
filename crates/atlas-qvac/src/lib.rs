//! atlas-qvac — Local-AI surfaces over Tether QVAC (directive 19).
//!
//! Four user-facing surfaces; each is *advisory UX*, never on the
//! commitment path:
//!
//! 1. **Pre-Sign Explainer** — local LLM renders the structured
//!    `/api/v1/simulate/{ix}` payload as a 3-sentence summary in
//!    the user's locale. Numeric-token verification + hand-template
//!    fallback are mandatory.
//! 2. **Invoice OCR** — local OCR extracts vendor / amount / due
//!    date from a paper or PDF invoice into a `DraftInvoiceState`.
//!    Operator confirms before any state submits to Atlas.
//! 3. **Treasury Translation** — local NMT model translates alert
//!    bodies + ledger row renderings; identifiers and numbers stay
//!    verbatim. Cached by `(template_hash, target_locale)`.
//! 4. **Second-Opinion Analyst** — local LLM + RAG produces an
//!    independent review of a pending Squads bundle. Approver still
//!    signs (or doesn't) on their own judgment.
//!
//! Hard rule: QVAC output never enters a Poseidon commitment path.
//! The runtime lint `lint_no_qvac_in_commitment_path` (atlas-runtime)
//! blocks misuse.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod analyst;
pub mod explainer;
pub mod ocr;
pub mod surface;
pub mod translation;

pub use analyst::{
    AnalystAssessment, AnalystError, AnalystRecommendation, AnalystSummary,
    UnrecognisedConcern, FAILURE_CLASS_CATALOG,
};
pub use explainer::{
    explain_or_fallback, render_template_fallback, verify_numeric_tokens,
    ExplainerError, ExplainerOutcome, PreSignExplanation,
};
pub use ocr::{
    DraftInvoiceState, InvoiceField, InvoiceOcrError, OcrConfidence, OcrSource,
};
pub use surface::{QvacSurface, SurfaceTransport};
pub use translation::{
    cache_key, render_translated_alert, translation_cache_key, AlertTranslation,
    TranslationCache, TranslationError,
};

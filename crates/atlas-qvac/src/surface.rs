//! Surface registry (directive §0 + §9).
//!
//! Each Tier-A surface ships through one or more transports
//! (iOS, browser extension, web). Surface metadata drives the
//! `/api/v1/legal/qvac` privacy notice and the playground page.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QvacSurface {
    /// Surface 1 — local LLM renders the pre-sign payload.
    PreSignExplainer,
    /// Surface 2 — local OCR scans a paper / PDF invoice.
    InvoiceOcr,
    /// Surface 3 — local NMT translates alerts + ledger rows.
    TreasuryTranslation,
    /// Surface 4 — local LLM + RAG gives a second opinion on a
    /// pending bundle.
    SecondOpinionAnalyst,
}

impl QvacSurface {
    pub fn name(self) -> &'static str {
        match self {
            QvacSurface::PreSignExplainer => "pre_sign_explainer",
            QvacSurface::InvoiceOcr => "invoice_ocr",
            QvacSurface::TreasuryTranslation => "treasury_translation",
            QvacSurface::SecondOpinionAnalyst => "second_opinion_analyst",
        }
    }

    /// Cold-load p95 budget per directive §11.
    pub fn cold_load_p95_seconds(self) -> u32 {
        match self {
            QvacSurface::PreSignExplainer | QvacSurface::SecondOpinionAnalyst => 6,
            QvacSurface::InvoiceOcr => 3,
            QvacSurface::TreasuryTranslation => 3,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SurfaceTransport {
    Ios,
    BrowserExtension,
    Web,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cold_load_budgets_match_directive() {
        assert_eq!(QvacSurface::PreSignExplainer.cold_load_p95_seconds(), 6);
        assert_eq!(QvacSurface::SecondOpinionAnalyst.cold_load_p95_seconds(), 6);
        assert_eq!(QvacSurface::InvoiceOcr.cold_load_p95_seconds(), 3);
        assert_eq!(QvacSurface::TreasuryTranslation.cold_load_p95_seconds(), 3);
    }

    #[test]
    fn surface_names_unique() {
        let names = [
            QvacSurface::PreSignExplainer.name(),
            QvacSurface::InvoiceOcr.name(),
            QvacSurface::TreasuryTranslation.name(),
            QvacSurface::SecondOpinionAnalyst.name(),
        ];
        let mut sorted = names.to_vec();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), names.len());
    }
}

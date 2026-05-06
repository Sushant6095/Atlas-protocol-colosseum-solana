//! Local Invoice OCR (directive §3).
//!
//! Local OCR extracts vendor / amount / due-date fields from a
//! paper or PDF invoice into a `DraftInvoiceState`. The image and
//! the raw OCR text never leave the operator's device. Only the
//! operator-confirmed fields submit to Atlas.
//!
//! The crate models the draft + the field-confidence shape; the
//! actual OCR runner is the QVAC SDK call in the host app.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OcrSource {
    /// Field came from the local OCR run.
    LocalOcr,
    /// Operator hand-edited or filled in this field.
    Operator,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OcrConfidence {
    /// > 0.85 confidence — show as accepted.
    High,
    /// 0.5–0.85 confidence — surface for review with the bbox visible.
    Medium,
    /// < 0.5 confidence — leave blank; operator fills.
    Low,
}

impl OcrConfidence {
    pub fn from_score(score: f32) -> Self {
        if score >= 0.85 {
            OcrConfidence::High
        } else if score >= 0.5 {
            OcrConfidence::Medium
        } else {
            OcrConfidence::Low
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceField<T> {
    pub value: Option<T>,
    pub confidence: OcrConfidence,
    pub source: OcrSource,
}

impl<T> InvoiceField<T> {
    pub fn empty() -> Self {
        Self { value: None, confidence: OcrConfidence::Low, source: OcrSource::LocalOcr }
    }
    pub fn from_local_ocr(value: T, score: f32) -> Self {
        Self {
            value: Some(value),
            confidence: OcrConfidence::from_score(score),
            source: OcrSource::LocalOcr,
        }
    }
    pub fn override_by_operator(&mut self, value: T) {
        self.value = Some(value);
        self.confidence = OcrConfidence::High;
        self.source = OcrSource::Operator;
    }
    /// Operator accepts a High-confidence local OCR result without
    /// editing. The value is unchanged; `source` flips to
    /// `Operator` so `is_confirmed()` accepts the field.
    pub fn accept_local_ocr(&mut self) {
        if self.confidence == OcrConfidence::High {
            self.source = OcrSource::Operator;
        }
    }
    pub fn requires_review(&self) -> bool {
        self.value.is_none()
            || self.confidence != OcrConfidence::High
            || self.source != OcrSource::Operator
    }
}

fn confirmed<T>(f: &InvoiceField<T>) -> bool {
    f.value.is_some()
        && f.confidence == OcrConfidence::High
        && f.source == OcrSource::Operator
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DraftInvoiceState {
    pub vendor_name: InvoiceField<String>,
    pub amount_q64: InvoiceField<u128>,
    pub mint: InvoiceField<String>,
    pub due_at_unix: InvoiceField<u64>,
    pub vendor_reference: InvoiceField<String>,
    pub source: OcrSource,
    /// blake3 over the local image bytes; used as a stable client-side
    /// id so the operator can re-open a draft. The image itself is
    /// never sent to Atlas.
    pub local_image_digest: [u8; 32],
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum InvoiceOcrError {
    #[error("draft has unconfirmed fields requiring operator review")]
    UnconfirmedFields,
    #[error("vendor_name is blank")]
    MissingVendor,
    #[error("amount_q64 is blank")]
    MissingAmount,
    #[error("mint is blank")]
    MissingMint,
    #[error("due_at_unix is blank")]
    MissingDueDate,
}

impl DraftInvoiceState {
    pub fn from_local_ocr(local_image_digest: [u8; 32]) -> Self {
        Self {
            vendor_name: InvoiceField::empty(),
            amount_q64: InvoiceField::empty(),
            mint: InvoiceField::empty(),
            due_at_unix: InvoiceField::empty(),
            vendor_reference: InvoiceField::empty(),
            source: OcrSource::LocalOcr,
            local_image_digest,
        }
    }

    /// Returns true iff every required field is confirmed by the
    /// operator (High confidence + Operator source — i.e., either
    /// hand-edited or one-tap accepted). Atlas refuses to ingest
    /// a draft where this is false.
    pub fn is_confirmed(&self) -> bool {
        confirmed(&self.vendor_name)
            && confirmed(&self.amount_q64)
            && confirmed(&self.mint)
            && confirmed(&self.due_at_unix)
    }

    /// Validate before submitting to Atlas. Returns the first
    /// missing-field error in deterministic order.
    pub fn validate_for_submission(&self) -> Result<(), InvoiceOcrError> {
        if self.vendor_name.value.is_none() {
            return Err(InvoiceOcrError::MissingVendor);
        }
        if self.amount_q64.value.is_none() {
            return Err(InvoiceOcrError::MissingAmount);
        }
        if self.mint.value.is_none() {
            return Err(InvoiceOcrError::MissingMint);
        }
        if self.due_at_unix.value.is_none() {
            return Err(InvoiceOcrError::MissingDueDate);
        }
        if !self.is_confirmed() {
            return Err(InvoiceOcrError::UnconfirmedFields);
        }
        Ok(())
    }

    /// Helper for the playground / iOS app: list the fields that
    /// still require operator review.
    pub fn review_fields(&self) -> Vec<&'static str> {
        let mut out = Vec::new();
        if self.vendor_name.requires_review() { out.push("vendor_name"); }
        if self.amount_q64.requires_review() { out.push("amount_q64"); }
        if self.mint.requires_review() { out.push("mint"); }
        if self.due_at_unix.requires_review() { out.push("due_at_unix"); }
        if self.vendor_reference.requires_review() { out.push("vendor_reference"); }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confidence_from_score_buckets() {
        assert_eq!(OcrConfidence::from_score(0.95), OcrConfidence::High);
        assert_eq!(OcrConfidence::from_score(0.85), OcrConfidence::High);
        assert_eq!(OcrConfidence::from_score(0.7), OcrConfidence::Medium);
        assert_eq!(OcrConfidence::from_score(0.5), OcrConfidence::Medium);
        assert_eq!(OcrConfidence::from_score(0.3), OcrConfidence::Low);
    }

    #[test]
    fn empty_draft_has_all_fields_in_review() {
        let d = DraftInvoiceState::from_local_ocr([0u8; 32]);
        let r = d.review_fields();
        assert!(r.contains(&"vendor_name"));
        assert!(r.contains(&"amount_q64"));
        assert!(r.contains(&"mint"));
        assert!(r.contains(&"due_at_unix"));
    }

    #[test]
    fn high_confidence_local_ocr_still_requires_operator_accept() {
        let mut f: InvoiceField<u128> = InvoiceField::from_local_ocr(1_000_000, 0.95);
        // High confidence on its own is not "confirmed" — operator
        // must accept (or hand-edit). is_confirmed() at the draft
        // level enforces this.
        assert_eq!(f.source, OcrSource::LocalOcr);
        f.accept_local_ocr();
        assert_eq!(f.source, OcrSource::Operator);
        assert_eq!(f.confidence, OcrConfidence::High);
    }

    #[test]
    fn accept_local_ocr_no_op_for_low_confidence() {
        let mut f: InvoiceField<u128> = InvoiceField::from_local_ocr(1_000_000, 0.3);
        f.accept_local_ocr();
        assert_eq!(f.source, OcrSource::LocalOcr);
        assert_eq!(f.confidence, OcrConfidence::Low);
    }

    #[test]
    fn override_by_operator_sets_high_and_operator_source() {
        let mut f: InvoiceField<u128> = InvoiceField::empty();
        f.override_by_operator(1_000_000);
        assert_eq!(f.confidence, OcrConfidence::High);
        assert_eq!(f.source, OcrSource::Operator);
        assert_eq!(f.value, Some(1_000_000));
    }

    #[test]
    fn validate_rejects_missing_vendor() {
        let mut d = DraftInvoiceState::from_local_ocr([0u8; 32]);
        d.amount_q64.override_by_operator(1_000_000);
        d.mint.override_by_operator("USDC".into());
        d.due_at_unix.override_by_operator(1_700_000_000);
        let r = d.validate_for_submission();
        assert!(matches!(r, Err(InvoiceOcrError::MissingVendor)));
    }

    #[test]
    fn validate_rejects_unconfirmed_low_confidence() {
        let mut d = DraftInvoiceState::from_local_ocr([0u8; 32]);
        d.vendor_name.override_by_operator("ACME".into());
        d.amount_q64 = InvoiceField::from_local_ocr(1_000_000, 0.3); // Low
        d.mint.override_by_operator("USDC".into());
        d.due_at_unix.override_by_operator(1_700_000_000);
        let r = d.validate_for_submission();
        // Amount has a value but Low confidence; is_confirmed() is false.
        assert!(matches!(r, Err(InvoiceOcrError::UnconfirmedFields)));
    }

    #[test]
    fn validate_passes_when_all_fields_operator_confirmed() {
        let mut d = DraftInvoiceState::from_local_ocr([0u8; 32]);
        d.vendor_name.override_by_operator("ACME".into());
        d.amount_q64.override_by_operator(1_000_000);
        d.mint.override_by_operator("USDC".into());
        d.due_at_unix.override_by_operator(1_700_000_000);
        d.validate_for_submission().unwrap();
    }

    #[test]
    fn local_image_digest_round_trips() {
        let d = DraftInvoiceState::from_local_ocr([7u8; 32]);
        assert_eq!(d.local_image_digest, [7u8; 32]);
    }

    #[test]
    fn requires_review_high_confidence_local_ocr_still_needs_accept() {
        let f = InvoiceField::from_local_ocr("ACME".to_string(), 0.95);
        // High-confidence local OCR is still subject to explicit
        // operator confirmation per directive §3.1 step 4. The UI
        // surfaces a one-tap accept; until that happens, the field
        // requires review.
        assert!(f.requires_review());
    }

    #[test]
    fn requires_review_false_after_operator_accept() {
        let mut f = InvoiceField::from_local_ocr("ACME".to_string(), 0.95);
        f.accept_local_ocr();
        assert!(!f.requires_review());
    }
}

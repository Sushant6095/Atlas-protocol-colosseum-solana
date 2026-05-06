// @atlas/qvac — typed adapters over Tether QVAC SDK (Phase 19).
//
// Four Tier-A surfaces, each pure TypeScript, each accepting a
// caller-supplied QVAC runner so the package works in iOS / browser
// extension / web without bundling a model. The crate `atlas-qvac`
// is the canonical contract; this package mirrors it for JS hosts.

export { explainPreSign, type ExplainerRunner, type ExplainerOutcome } from "./explainer.js";
export {
  draftFromLocalOcr,
  acceptOcrField,
  validateForSubmission,
  type DraftInvoiceState,
  type OcrConfidence,
  type OcrSource,
  type InvoiceField,
  type InvoiceOcrError,
} from "./ocr.js";
export {
  TranslationCache,
  renderTranslatedAlert,
  type AlertTranslation,
  type TranslationError,
  type LocaleTag,
} from "./translation.js";
export {
  summariseAssessment,
  isConcernRecognised,
  FAILURE_CLASS_CATALOG,
  type AnalystAssessment,
  type AnalystSummary,
  type AnalystRecommendation,
} from "./analyst.js";

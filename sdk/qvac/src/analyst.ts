// Local Second-Opinion Analyst adapter (Phase 19 §5).
//
// Mirrors atlas_qvac::analyst. The catalog must stay in sync with
// atlas_failure::class::FailureClass; this file is the JS-side
// authoritative copy.

export type AnalystRecommendation = "approve" | "reject" | "escalate";

export interface AnalystAssessment {
  recommendation: AnalystRecommendation;
  confidence_bps: number; // 0..=10_000
  concerns: string[];
  comparison_to_last_30d: string;
  fields_to_double_check: string[];
}

export interface UnrecognisedConcern {
  raw_text: string;
}

export interface AnalystSummary {
  assessment: AnalystAssessment;
  unrecognised_concerns: UnrecognisedConcern[];
  clears_for_signing: boolean;
}

export const FAILURE_CLASS_CATALOG: readonly string[] = [
  "quorum_disagreement",
  "source_quarantined",
  "rpc_timeout",
  "stale_account",
  "oracle_stale",
  "oracle_deviation",
  "pyth_pull_post_failed",
  "agent_timeout",
  "hard_veto",
  "disagreement_over_threshold",
  "proof_gen_timeout",
  "proof_verify_failed",
  "proof_public_input_mismatch",
  "compute_exhaustion",
  "cpi_failure",
  "slippage_violation",
  "post_condition_violation",
  "bundle_not_landed",
  "alt_missing_account",
  "archival_write_failed",
  "bubblegum_anchor_lag",
  "stale_proof_replay_detected",
  "forged_vault_target",
  "manipulated_state_root",
  "per_session_expired",
  "settlement_verifier_reject",
  "per_operator_censorship",
  "per_settlement_replay",
];

export function isConcernRecognised(text: string): boolean {
  const lower = text.toLowerCase();
  return FAILURE_CLASS_CATALOG.some(k => lower.includes(k));
}

export function summariseAssessment(a: AnalystAssessment): AnalystSummary {
  if (a.confidence_bps > 10_000) {
    throw new Error(`confidence_bps ${a.confidence_bps} exceeds 10_000`);
  }
  if (a.recommendation === "approve" && a.concerns.length > 0) {
    throw new Error(
      `recommendation=approve but ${a.concerns.length} concerns flagged — UI must surface as Escalate`,
    );
  }
  const unrecognised: UnrecognisedConcern[] = a.concerns
    .filter(c => !isConcernRecognised(c))
    .map(raw_text => ({ raw_text }));
  const clears = a.recommendation === "approve" && unrecognised.length === 0;
  return {
    assessment: a,
    unrecognised_concerns: unrecognised,
    clears_for_signing: clears,
  };
}

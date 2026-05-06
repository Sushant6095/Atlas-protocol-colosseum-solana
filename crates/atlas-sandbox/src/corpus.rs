//! Mandatory sandbox test corpus (directive §4).
//!
//! A model cannot transition `Draft → Audited` until every corpus check
//! passes. The shape lives here so registry CLI / CI driver can inspect
//! a corpus report and gate the audit transition without re-running the
//! sandbox.
//!
//! Corpus requirements (each `CorpusRequirement` MUST be `Pass` for the
//! corpus to be `all_pass`):
//!
//! 1. `HistoricalReplay`  — 90-day historical across ≥3 distinct regimes.
//! 2. `ChaosSuite`        — Phase 08 scenarios all pass.
//! 3. `AbCompareApproved` — paired bootstrap CI vs current Approved
//!                          model is statistically significant positive
//!                          OR equivalent within tolerance.
//! 4. `LeakageProbe`      — random feature shuffle test collapses to
//!                          baseline (LeakageProbe.is_clean()).
//! 5. `Determinism`       — 5 independent runs produce byte-identical
//!                          report bytes.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum CorpusRequirement {
    HistoricalReplay,
    ChaosSuite,
    AbCompareApproved,
    LeakageProbe,
    Determinism,
}

impl CorpusRequirement {
    pub const fn all() -> &'static [CorpusRequirement] {
        &[
            CorpusRequirement::HistoricalReplay,
            CorpusRequirement::ChaosSuite,
            CorpusRequirement::AbCompareApproved,
            CorpusRequirement::LeakageProbe,
            CorpusRequirement::Determinism,
        ]
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CorpusResult {
    pub requirement: CorpusRequirement,
    pub passed: bool,
    /// Free-form short note for the audit log (e.g., "3/3 regimes",
    /// "shuffled MAE 5800 vs unshuffled 120").
    pub detail: String,
    /// Optional report URI written by whichever sandbox subcommand
    /// produced this result.
    pub report_uri: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CorpusReport {
    pub model_id: [u8; 32],
    pub sandbox_run_id: [u8; 32],
    pub generated_at_slot: u64,
    pub results: Vec<CorpusResult>,
}

impl CorpusReport {
    pub fn new(model_id: [u8; 32], sandbox_run_id: [u8; 32], generated_at_slot: u64) -> Self {
        Self { model_id, sandbox_run_id, generated_at_slot, results: Vec::new() }
    }

    pub fn record(
        &mut self,
        requirement: CorpusRequirement,
        passed: bool,
        detail: impl Into<String>,
        report_uri: Option<String>,
    ) {
        // Replace any existing entry for this requirement so the report
        // is well-formed even if a step is rerun.
        self.results.retain(|r| r.requirement != requirement);
        self.results.push(CorpusResult {
            requirement,
            passed,
            detail: detail.into(),
            report_uri,
        });
    }

    /// Returns true iff every directive §4 requirement has at least one
    /// recorded result and every recorded result is `passed`.
    pub fn all_pass(&self) -> bool {
        for req in CorpusRequirement::all() {
            match self.results.iter().find(|r| r.requirement == *req) {
                Some(r) if r.passed => continue,
                _ => return false,
            }
        }
        !self.results.iter().any(|r| !r.passed)
    }

    /// Requirements that are missing or failing — used for human-readable
    /// CI diagnostics.
    pub fn missing_or_failing(&self) -> Vec<CorpusRequirement> {
        let mut out = Vec::new();
        for req in CorpusRequirement::all() {
            match self.results.iter().find(|r| r.requirement == *req) {
                Some(r) if r.passed => {}
                _ => out.push(*req),
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh() -> CorpusReport {
        CorpusReport::new([1u8; 32], [2u8; 32], 100)
    }

    fn complete_pass() -> CorpusReport {
        let mut r = fresh();
        for req in CorpusRequirement::all() {
            r.record(*req, true, "ok", None);
        }
        r
    }

    #[test]
    fn empty_corpus_is_not_pass() {
        let r = fresh();
        assert!(!r.all_pass());
        assert_eq!(r.missing_or_failing().len(), 5);
    }

    #[test]
    fn all_five_requirements_pass_passes() {
        let r = complete_pass();
        assert!(r.all_pass());
        assert!(r.missing_or_failing().is_empty());
    }

    #[test]
    fn one_failing_blocks_all_pass() {
        let mut r = complete_pass();
        r.record(CorpusRequirement::LeakageProbe, false, "shuffle MAE 110 vs unshuffled 100", None);
        assert!(!r.all_pass());
        assert_eq!(r.missing_or_failing(), vec![CorpusRequirement::LeakageProbe]);
    }

    #[test]
    fn rerun_replaces_prior_result() {
        let mut r = fresh();
        r.record(CorpusRequirement::Determinism, false, "first run differed", None);
        for req in CorpusRequirement::all() {
            r.record(*req, true, "ok", None);
        }
        // Determinism re-recorded as passed; report should not carry the
        // earlier failed entry.
        let det = r
            .results
            .iter()
            .filter(|x| x.requirement == CorpusRequirement::Determinism)
            .count();
        assert_eq!(det, 1);
        assert!(r.all_pass());
    }
}

//! Outcome contract (directive §1.7).
//!
//! Every injector is annotated with an `ExpectedOutcome`. The harness
//! observes the pipeline's actual outcome and reports any deviation —
//! deviations fail the test (anti-pattern §7 last bullet).

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExpectedOutcome {
    /// Rebalance proceeds; metrics may show degraded confidence.
    RebalanceProceeds,
    /// Defensive vector engages — still on chain, but allocation
    /// collapses to the safe baseline.
    DefensiveMode,
    /// Pipeline halts; no rebalance is attempted.
    Halt,
    /// Verifier (off-chain or on-chain) rejects the proof.
    RejectAtVerifier,
    /// Bundle is composed and submitted but reverts atomically (e.g.,
    /// CpiFailure, SlippageBlowout post-trade revert).
    BundleAborts,
    /// No state change; the only signal is an alert in the alert
    /// engine. Used for low-severity noise (RpcLatency well below
    /// threshold, etc).
    AlertOnly,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObservedOutcome {
    RebalanceProceeds,
    DefensiveMode,
    Halt,
    RejectAtVerifier,
    BundleAborts,
    AlertOnly,
    /// Pipeline produced an outcome the harness can't categorize.
    Unknown,
}

impl ObservedOutcome {
    pub fn matches(self, expected: ExpectedOutcome) -> bool {
        match (self, expected) {
            (ObservedOutcome::RebalanceProceeds, ExpectedOutcome::RebalanceProceeds) => true,
            (ObservedOutcome::DefensiveMode, ExpectedOutcome::DefensiveMode) => true,
            (ObservedOutcome::Halt, ExpectedOutcome::Halt) => true,
            (ObservedOutcome::RejectAtVerifier, ExpectedOutcome::RejectAtVerifier) => true,
            (ObservedOutcome::BundleAborts, ExpectedOutcome::BundleAborts) => true,
            (ObservedOutcome::AlertOnly, ExpectedOutcome::AlertOnly) => true,
            _ => false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct OutcomeDeviation {
    pub injector_name: String,
    pub expected: ExpectedOutcome,
    pub observed: ObservedOutcome,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matching_outcome_passes() {
        assert!(ObservedOutcome::DefensiveMode.matches(ExpectedOutcome::DefensiveMode));
    }

    #[test]
    fn unknown_observed_never_matches() {
        for e in [
            ExpectedOutcome::RebalanceProceeds,
            ExpectedOutcome::DefensiveMode,
            ExpectedOutcome::Halt,
            ExpectedOutcome::RejectAtVerifier,
            ExpectedOutcome::BundleAborts,
            ExpectedOutcome::AlertOnly,
        ] {
            assert!(!ObservedOutcome::Unknown.matches(e));
        }
    }

    #[test]
    fn cross_outcome_does_not_match() {
        assert!(!ObservedOutcome::DefensiveMode.matches(ExpectedOutcome::RebalanceProceeds));
        assert!(!ObservedOutcome::Halt.matches(ExpectedOutcome::AlertOnly));
    }
}

//! Structured chaos run report (directive §5).

use crate::env::ChaosTarget;
use crate::inject::ChaosInject;
use crate::outcome::{ExpectedOutcome, ObservedOutcome, OutcomeDeviation};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunbookHit {
    pub runbook_path: String,
    /// Slot at which the oncall began following the runbook.
    pub started_at_slot: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChaosReport {
    pub run_id: [u8; 32],
    pub scenario: String,
    pub target: ChaosTarget,
    pub seed: u64,
    pub started_at_slot: u64,
    pub ended_at_slot: u64,
    pub injectors: Vec<ChaosInject>,
    pub expected_outcomes: BTreeMap<String, ExpectedOutcome>,
    pub observed_outcomes: BTreeMap<String, ObservedOutcome>,
    pub deviations: Vec<OutcomeDeviation>,
    pub alerts_fired: Vec<String>,
    pub runbook_followed: Option<RunbookHit>,
    /// Mean time to detect — first alert minus injection slot.
    pub mttd_seconds: u32,
    /// Mean time to recover — runbook completion minus injection slot.
    pub mttr_seconds: u32,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RunReportError {
    #[error("scenario name must be non-empty")]
    EmptyScenario,
    #[error("ended_at_slot {ended} <= started_at_slot {started}")]
    InvertedRange { started: u64, ended: u64 },
}

impl ChaosReport {
    pub fn new(
        scenario: impl Into<String>,
        target: ChaosTarget,
        seed: u64,
        started_at_slot: u64,
        ended_at_slot: u64,
    ) -> Result<Self, RunReportError> {
        let scenario = scenario.into();
        if scenario.is_empty() {
            return Err(RunReportError::EmptyScenario);
        }
        if ended_at_slot <= started_at_slot {
            return Err(RunReportError::InvertedRange {
                started: started_at_slot,
                ended: ended_at_slot,
            });
        }
        let run_id = compute_run_id(&scenario, target, seed, started_at_slot, ended_at_slot);
        Ok(Self {
            run_id,
            scenario,
            target,
            seed,
            started_at_slot,
            ended_at_slot,
            injectors: Vec::new(),
            expected_outcomes: BTreeMap::new(),
            observed_outcomes: BTreeMap::new(),
            deviations: Vec::new(),
            alerts_fired: Vec::new(),
            runbook_followed: None,
            mttd_seconds: 0,
            mttr_seconds: 0,
        })
    }

    pub fn record_case(
        &mut self,
        injector: ChaosInject,
        expected: ExpectedOutcome,
        observed: ObservedOutcome,
    ) {
        let name = injector.name().to_string();
        if !observed.matches(expected) {
            self.deviations.push(OutcomeDeviation {
                injector_name: name.clone(),
                expected,
                observed,
            });
        }
        self.expected_outcomes.insert(name.clone(), expected);
        self.observed_outcomes.insert(name, observed);
        self.injectors.push(injector);
    }

    /// Returns `true` iff the run is clean — no outcome deviations.
    /// CI uses this as the pass / fail gate.
    pub fn passed(&self) -> bool {
        self.deviations.is_empty()
    }
}

fn compute_run_id(
    scenario: &str,
    target: ChaosTarget,
    seed: u64,
    started_at_slot: u64,
    ended_at_slot: u64,
) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.chaos.run.v1");
    h.update(scenario.as_bytes());
    h.update(&[0]);
    h.update(target.name().as_bytes());
    h.update(&[0]);
    h.update(&seed.to_le_bytes());
    h.update(&started_at_slot.to_le_bytes());
    h.update(&ended_at_slot.to_le_bytes());
    *h.finalize().as_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::inject::ChaosInject;
    use atlas_failure::class::SourceId;

    fn fresh() -> ChaosReport {
        ChaosReport::new("test-scenario", ChaosTarget::Sandbox, 42, 100, 200).unwrap()
    }

    #[test]
    fn empty_run_passes() {
        let r = fresh();
        assert!(r.passed());
    }

    #[test]
    fn matching_case_does_not_deviate() {
        let mut r = fresh();
        r.record_case(
            ChaosInject::RpcLatency { source: SourceId(1), added_ms: 600 },
            ExpectedOutcome::RebalanceProceeds,
            ObservedOutcome::RebalanceProceeds,
        );
        assert!(r.passed());
    }

    #[test]
    fn mismatched_case_records_deviation() {
        let mut r = fresh();
        r.record_case(
            ChaosInject::OracleStale { feed_id: atlas_failure::class::FeedId(1), hold_slots: 50 },
            ExpectedOutcome::DefensiveMode,
            ObservedOutcome::RebalanceProceeds,
        );
        assert!(!r.passed());
        assert_eq!(r.deviations.len(), 1);
    }

    #[test]
    fn run_id_changes_on_inputs() {
        let a = ChaosReport::new("s", ChaosTarget::Sandbox, 1, 0, 10).unwrap();
        let b = ChaosReport::new("s", ChaosTarget::Sandbox, 2, 0, 10).unwrap();
        assert_ne!(a.run_id, b.run_id);
    }

    #[test]
    fn empty_scenario_rejects() {
        assert!(matches!(
            ChaosReport::new("", ChaosTarget::Sandbox, 1, 0, 10),
            Err(RunReportError::EmptyScenario)
        ));
    }

    #[test]
    fn inverted_range_rejects() {
        assert!(matches!(
            ChaosReport::new("s", ChaosTarget::Sandbox, 1, 100, 50),
            Err(RunReportError::InvertedRange { .. })
        ));
    }
}

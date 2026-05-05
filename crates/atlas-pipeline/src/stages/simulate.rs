//! Stage 14 — SimulateExecution (simulation gate).
//!
//! Before bundle submission, we simulate via `simulateBundle` (or per-tx
//! `simulateTransaction`) and reject on:
//!   - non-zero `err`
//!   - any log line matching the recognized failure-string allowlist
//!   - CU usage exceeding the predicted CU by > 25%

use crate::stages::planning::CU_BUDGET_PER_TX;

pub const CU_DRIFT_REJECT_BPS: u32 = 2_500; // 25%

/// Recognized log substrings that imply the tx is unsafe to land. Keep this
/// list explicit and small — every entry is a ground-truth failure mode.
pub const RECOGNIZED_FAILURE_STRINGS: &[&str] = &[
    "insufficient funds",
    "slippage",
    "stale oracle",
    "Slippage",
    "InsufficientFunds",
    "StaleOracle",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SimulationReport {
    pub err: Option<String>,
    pub logs: Vec<String>,
    pub cu_used: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SimulationVerdict {
    Accept,
    RejectExecutionError(String),
    RejectRecognizedLog(String),
    RejectCuDrift { predicted: u32, observed: u32, drift_bps: u32 },
    RejectCuOverBudget { observed: u32, budget: u32 },
}

pub fn evaluate_simulation(
    report: &SimulationReport,
    predicted_cu: u32,
) -> SimulationVerdict {
    if let Some(err) = &report.err {
        return SimulationVerdict::RejectExecutionError(err.clone());
    }

    for log in &report.logs {
        for needle in RECOGNIZED_FAILURE_STRINGS {
            if log.contains(needle) {
                return SimulationVerdict::RejectRecognizedLog((*needle).to_string());
            }
        }
    }

    if report.cu_used > CU_BUDGET_PER_TX {
        return SimulationVerdict::RejectCuOverBudget {
            observed: report.cu_used,
            budget: CU_BUDGET_PER_TX,
        };
    }

    if predicted_cu > 0 {
        let predicted = predicted_cu as u64;
        let observed = report.cu_used as u64;
        if observed > predicted {
            let drift_bps = ((observed - predicted) * 10_000 / predicted) as u32;
            if drift_bps > CU_DRIFT_REJECT_BPS {
                return SimulationVerdict::RejectCuDrift {
                    predicted: predicted_cu,
                    observed: report.cu_used,
                    drift_bps,
                };
            }
        }
    }

    SimulationVerdict::Accept
}

#[cfg(test)]
mod tests {
    use super::*;

    fn report(err: Option<&str>, logs: &[&str], cu: u32) -> SimulationReport {
        SimulationReport {
            err: err.map(String::from),
            logs: logs.iter().map(|s| (*s).to_string()).collect(),
            cu_used: cu,
        }
    }

    #[test]
    fn accept_clean_simulation() {
        let r = report(None, &["Program log: ok"], 800_000);
        assert!(matches!(
            evaluate_simulation(&r, 900_000),
            SimulationVerdict::Accept
        ));
    }

    #[test]
    fn reject_execution_error() {
        let r = report(Some("ProgramFailedToComplete"), &[], 0);
        assert!(matches!(
            evaluate_simulation(&r, 900_000),
            SimulationVerdict::RejectExecutionError(_)
        ));
    }

    #[test]
    fn reject_slippage_log() {
        let r = report(None, &["Program log: Slippage exceeded by 500 bps"], 800_000);
        assert!(matches!(
            evaluate_simulation(&r, 900_000),
            SimulationVerdict::RejectRecognizedLog(_)
        ));
    }

    #[test]
    fn reject_insufficient_funds() {
        let r = report(None, &["Error: insufficient funds for instruction"], 800_000);
        assert!(matches!(
            evaluate_simulation(&r, 900_000),
            SimulationVerdict::RejectRecognizedLog(_)
        ));
    }

    #[test]
    fn reject_stale_oracle() {
        let r = report(None, &["Pyth: stale oracle, slot lag 50"], 800_000);
        assert!(matches!(
            evaluate_simulation(&r, 900_000),
            SimulationVerdict::RejectRecognizedLog(_)
        ));
    }

    #[test]
    fn reject_cu_drift_above_25_percent() {
        let r = report(None, &[], 1_300_000);
        // predicted 1_000_000 → +30% drift, must reject
        match evaluate_simulation(&r, 1_000_000) {
            SimulationVerdict::RejectCuDrift { drift_bps, .. } => {
                assert!(drift_bps > CU_DRIFT_REJECT_BPS);
            }
            other => panic!("expected RejectCuDrift, got {:?}", other),
        }
    }

    #[test]
    fn accept_cu_drift_under_25_percent() {
        let r = report(None, &[], 1_200_000);
        // predicted 1_000_000 → +20% drift, accept
        assert!(matches!(
            evaluate_simulation(&r, 1_000_000),
            SimulationVerdict::Accept
        ));
    }

    #[test]
    fn reject_cu_over_budget_outright() {
        let r = report(None, &[], CU_BUDGET_PER_TX + 1);
        assert!(matches!(
            evaluate_simulation(&r, CU_BUDGET_PER_TX),
            SimulationVerdict::RejectCuOverBudget { .. }
        ));
    }
}

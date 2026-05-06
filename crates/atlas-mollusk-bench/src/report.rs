//! Regression detector — observed vs baseline CU.

use crate::baseline::BaselineDb;
use serde::{Deserialize, Serialize};

/// 5 % tolerance per directive §12 last bullet.
pub const REGRESSION_TOLERANCE_BPS: u32 = 500;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BenchObservation {
    pub program: String,
    pub ix: String,
    pub observed_cu: u32,
    /// Free-form provenance (CI run id, commit sha) so a regression
    /// detail points back to the exact run.
    pub provenance: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegressionDetail {
    pub program: String,
    pub ix: String,
    pub baseline_cu: u32,
    pub observed_cu: u32,
    pub regression_bps: u32,
    pub provenance: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegressionReport {
    pub regressions: Vec<RegressionDetail>,
    /// Observations with no baseline entry — these are net-new
    /// benchmarks. Surfaced separately because they need a deliberate
    /// baseline-add commit, not a green CI by accident.
    pub orphan_observations: Vec<BenchObservation>,
    pub tolerance_bps: u32,
}

impl RegressionReport {
    pub fn passed(&self) -> bool {
        self.regressions.is_empty() && self.orphan_observations.is_empty()
    }
}

/// Compare observations against baselines. A regression is flagged if
/// `observed_cu > baseline_cu * (1 + tolerance)`. Improvements
/// (observed < baseline) are silently allowed and surface as a TODO
/// to update the baseline downward.
pub fn check_regressions(
    db: &BaselineDb,
    observations: &[BenchObservation],
) -> RegressionReport {
    let mut regressions = Vec::new();
    let mut orphans = Vec::new();
    for obs in observations {
        let key = match db.get(&obs.program, &obs.ix) {
            Some(b) => b,
            None => {
                orphans.push(obs.clone());
                continue;
            }
        };
        // regression_bps = (observed - baseline) / baseline * 10_000.
        if obs.observed_cu <= key.baseline_cu {
            continue;
        }
        let delta = (obs.observed_cu - key.baseline_cu) as u64;
        let regression_bps = ((delta * 10_000) / key.baseline_cu as u64).min(u32::MAX as u64) as u32;
        if regression_bps > REGRESSION_TOLERANCE_BPS {
            regressions.push(RegressionDetail {
                program: obs.program.clone(),
                ix: obs.ix.clone(),
                baseline_cu: key.baseline_cu,
                observed_cu: obs.observed_cu,
                regression_bps,
                provenance: obs.provenance.clone(),
            });
        }
    }
    RegressionReport {
        regressions,
        orphan_observations: orphans,
        tolerance_bps: REGRESSION_TOLERANCE_BPS,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::baseline::Baseline;

    fn baseline_db() -> BaselineDb {
        let mut db = BaselineDb::new();
        db.insert(Baseline {
            program: "atlas_verifier".into(),
            ix: "verify".into(),
            baseline_cu: 250_000,
            note: None,
        })
        .unwrap();
        db.insert(Baseline {
            program: "atlas_rebalancer".into(),
            ix: "execute".into(),
            baseline_cu: 600_000,
            note: None,
        })
        .unwrap();
        db
    }

    fn obs(program: &str, ix: &str, cu: u32) -> BenchObservation {
        BenchObservation {
            program: program.into(),
            ix: ix.into(),
            observed_cu: cu,
            provenance: None,
        }
    }

    #[test]
    fn within_tolerance_passes() {
        // 250_000 → 252_500 = +1 % (100 bps) < 500 bps tolerance.
        let r = check_regressions(&baseline_db(), &[obs("atlas_verifier", "verify", 252_500)]);
        assert!(r.passed());
    }

    #[test]
    fn above_tolerance_fails() {
        // 250_000 → 270_000 = +8 % (800 bps) > 500 bps tolerance.
        let r = check_regressions(&baseline_db(), &[obs("atlas_verifier", "verify", 270_000)]);
        assert!(!r.passed());
        assert_eq!(r.regressions.len(), 1);
        assert_eq!(r.regressions[0].regression_bps, 800);
    }

    #[test]
    fn improvement_does_not_fail() {
        let r = check_regressions(&baseline_db(), &[obs("atlas_verifier", "verify", 240_000)]);
        assert!(r.passed());
    }

    #[test]
    fn orphan_observation_fails() {
        let r = check_regressions(&baseline_db(), &[obs("atlas_unknown", "foo", 100_000)]);
        assert!(!r.passed());
        assert_eq!(r.orphan_observations.len(), 1);
    }

    #[test]
    fn at_exact_tolerance_passes() {
        // 250_000 → 262_500 = +5 % (500 bps) — equals tolerance, allow.
        let r = check_regressions(&baseline_db(), &[obs("atlas_verifier", "verify", 262_500)]);
        assert!(r.passed(), "regressions: {:?}", r.regressions);
    }
}

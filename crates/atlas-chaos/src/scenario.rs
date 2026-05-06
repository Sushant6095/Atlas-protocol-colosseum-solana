//! Scenario suites — PR subset (§2.1) + mandatory game days (§3).

use crate::inject::ChaosInject;
use crate::outcome::ExpectedOutcome;
use atlas_failure::class::{FeedId, ProtocolId, SourceId};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScenarioCase {
    pub label: &'static str,
    pub injector: ChaosInject,
    pub expected: ExpectedOutcome,
}

/// Per-PR chaos subset — must complete in ≤ 5 minutes against a
/// Bankrun fixture. Failure of any case fails the PR (directive §2.1).
pub fn pr_subset() -> Vec<ScenarioCase> {
    vec![
        ScenarioCase {
            label: "rpc_latency_added_ms_600",
            injector: ChaosInject::RpcLatency { source: SourceId(1), added_ms: 600 },
            expected: ExpectedOutcome::RebalanceProceeds,
        },
        ScenarioCase {
            label: "oracle_drift_2bps_per_slot_for_100_slots",
            injector: ChaosInject::OracleDrift { feed_id: FeedId(1), bps_per_slot: 2 },
            expected: ExpectedOutcome::RebalanceProceeds,
        },
        ScenarioCase {
            label: "oracle_stale_50_slots",
            injector: ChaosInject::OracleStale { feed_id: FeedId(1), hold_slots: 50 },
            expected: ExpectedOutcome::DefensiveMode,
        },
        ScenarioCase {
            label: "cpi_failure_drift_immediate",
            injector: ChaosInject::CpiFailure {
                protocol: ProtocolId(2), // Drift
                error: "InsufficientLiquidity".into(),
                after_n_slots: 0,
            },
            expected: ExpectedOutcome::BundleAborts,
        },
        ScenarioCase {
            label: "stale_proof_replay_200_slots",
            injector: ChaosInject::StaleProofReplay { delay_slots: 200 },
            expected: ExpectedOutcome::RejectAtVerifier,
        },
        ScenarioCase {
            label: "forged_vault_target",
            injector: ChaosInject::ForgedVaultTarget { target: [0xff; 32] },
            expected: ExpectedOutcome::RejectAtVerifier,
        },
        ScenarioCase {
            label: "compute_overrun_2000_bps",
            injector: ChaosInject::ComputeOverrun { delta_bps: 2_000 },
            expected: ExpectedOutcome::BundleAborts,
        },
    ]
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameDayScenario {
    /// Total Helius outage (Yellowstone + webhooks).
    HeliusOutage,
    /// Pyth Hermes degraded (50 % post failure).
    PythHermesDegraded,
    /// Drift program upgrade with breaking ABI change to one ix.
    DriftAbiBreak,
    /// Mainnet congestion (tip-required for landing rises 10×).
    MainnetCongestion,
    /// Prover network full outage.
    ProverOutage,
    /// Bubblegum anchor keeper key loss.
    BubblegumKeeperLoss,
}

impl GameDayScenario {
    pub const fn slug(self) -> &'static str {
        match self {
            GameDayScenario::HeliusOutage => "helius-outage",
            GameDayScenario::PythHermesDegraded => "pyth-hermes-degraded",
            GameDayScenario::DriftAbiBreak => "drift-abi-break",
            GameDayScenario::MainnetCongestion => "mainnet-congestion",
            GameDayScenario::ProverOutage => "prover-outage",
            GameDayScenario::BubblegumKeeperLoss => "bubblegum-keeper-loss",
        }
    }

    pub const fn runbook_path(self) -> &'static str {
        match self {
            GameDayScenario::HeliusOutage => "ops/runbooks/helius-outage.md",
            GameDayScenario::PythHermesDegraded => "ops/runbooks/pyth-hermes-degraded.md",
            GameDayScenario::DriftAbiBreak => "ops/runbooks/drift-abi-break.md",
            GameDayScenario::MainnetCongestion => "ops/runbooks/mainnet-congestion.md",
            GameDayScenario::ProverOutage => "ops/runbooks/prover-outage.md",
            GameDayScenario::BubblegumKeeperLoss => "ops/runbooks/bubblegum-keeper-loss.md",
        }
    }

    /// Cases the chaos engineer injects to drive the scenario.
    pub fn cases(self) -> Vec<ScenarioCase> {
        match self {
            GameDayScenario::HeliusOutage => vec![
                ScenarioCase {
                    label: "yellowstone_drop",
                    injector: ChaosInject::RpcDrop { source: SourceId(1), prob_bps: 10_000 },
                    expected: ExpectedOutcome::DefensiveMode,
                },
                ScenarioCase {
                    label: "webhooks_drop",
                    injector: ChaosInject::WebsocketReset { source: SourceId(2), every_n_slots: 1 },
                    expected: ExpectedOutcome::DefensiveMode,
                },
            ],
            GameDayScenario::PythHermesDegraded => vec![
                ScenarioCase {
                    label: "pyth_post_50pct_miss",
                    injector: ChaosInject::PythPullPostFail { miss_rate_bps: 5_000 },
                    expected: ExpectedOutcome::DefensiveMode,
                },
            ],
            GameDayScenario::DriftAbiBreak => vec![
                ScenarioCase {
                    label: "drift_cpi_breaks_immediately",
                    injector: ChaosInject::CpiFailure {
                        protocol: ProtocolId(2),
                        error: "AccountDataDeserializationError".into(),
                        after_n_slots: 0,
                    },
                    expected: ExpectedOutcome::BundleAborts,
                },
            ],
            GameDayScenario::MainnetCongestion => vec![
                ScenarioCase {
                    label: "bundle_landing_rate_collapse",
                    injector: ChaosInject::BundleNotLanded { miss_rate_bps: 9_500 },
                    expected: ExpectedOutcome::AlertOnly,
                },
            ],
            GameDayScenario::ProverOutage => vec![
                ScenarioCase {
                    label: "prover_byzantine_with_invalid_proof",
                    injector: ChaosInject::ProverByzantine { invalid_proof: true, delay_ms: 0 },
                    expected: ExpectedOutcome::Halt,
                },
            ],
            GameDayScenario::BubblegumKeeperLoss => vec![
                ScenarioCase {
                    label: "anchor_keeper_unreachable",
                    // Modeled as a long stall on the archival source.
                    injector: ChaosInject::RpcLatency { source: SourceId(7), added_ms: 60_000 },
                    expected: ExpectedOutcome::Halt,
                },
            ],
        }
    }
}

pub const MANDATORY_GAME_DAYS: &[GameDayScenario] = &[
    GameDayScenario::HeliusOutage,
    GameDayScenario::PythHermesDegraded,
    GameDayScenario::DriftAbiBreak,
    GameDayScenario::MainnetCongestion,
    GameDayScenario::ProverOutage,
    GameDayScenario::BubblegumKeeperLoss,
];

pub fn game_day_scenarios() -> &'static [GameDayScenario] {
    MANDATORY_GAME_DAYS
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::inject::InjectorCategory;

    #[test]
    fn pr_subset_has_seven_cases() {
        // Directive §2.1 lists exactly 7 scenarios.
        assert_eq!(pr_subset().len(), 7);
    }

    #[test]
    fn pr_subset_covers_three_failure_axes() {
        let cats: std::collections::BTreeSet<_> =
            pr_subset().iter().map(|c| c.injector.category()).collect();
        // Network, Oracle, Execution, Adversarial — at least 4.
        assert!(cats.contains(&InjectorCategory::NetworkIngestion));
        assert!(cats.contains(&InjectorCategory::Oracle));
        assert!(cats.contains(&InjectorCategory::Execution));
        assert!(cats.contains(&InjectorCategory::Adversarial));
    }

    #[test]
    fn mandatory_game_days_count_is_six() {
        assert_eq!(MANDATORY_GAME_DAYS.len(), 6);
    }

    #[test]
    fn each_game_day_has_at_least_one_case() {
        for s in MANDATORY_GAME_DAYS {
            assert!(!s.cases().is_empty(), "{:?} has no cases", s);
        }
    }

    #[test]
    fn each_game_day_runbook_path_unique() {
        let mut paths: Vec<&str> = MANDATORY_GAME_DAYS.iter().map(|s| s.runbook_path()).collect();
        paths.sort();
        let total = paths.len();
        paths.dedup();
        assert_eq!(paths.len(), total);
    }
}

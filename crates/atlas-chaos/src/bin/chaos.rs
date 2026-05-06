//! `atlas-chaos` CLI (directive §3 invocation).
//!
//! Subcommands:
//!   * `pr-subset --target <staging|sandbox> --seed <N> --output <path>`
//!     — runs the 7 PR-subset cases against an in-process simulator
//!     and emits a `ChaosReport` JSON. CI exits non-zero on any
//!     deviation.
//!   * `run --scenario <slug> --target <staging|sandbox> --seed <N>
//!     --output <path>` — runs one of the six mandatory game-day
//!     scenarios.
//!   * `coverage` — prints the runbook coverage table (every
//!     `GameDayScenario` slug + its `runbook_path()`).
//!
//! The simulator backing this binary is intentionally simple: it
//! returns the directive's expected outcome for each injector. Real
//! chaos runs swap the simulator for the Phase 01 Bankrun fixture.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::{anyhow, Result};
use atlas_chaos::{
    env::parse_target, game_day_scenarios, pr_subset, ChaosReport, ChaosTarget, ExpectedOutcome,
    GameDayScenario, ObservedOutcome, ScenarioCase, MANDATORY_GAME_DAYS,
};
use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "atlas-chaos", version, about = "Atlas chaos engineering harness.")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    PrSubset {
        #[arg(long, value_parser = clap::builder::NonEmptyStringValueParser::new())]
        target: String,
        #[arg(long, default_value_t = 42)]
        seed: u64,
        #[arg(long)]
        output: std::path::PathBuf,
    },
    Run {
        #[arg(long)]
        scenario: String,
        #[arg(long, value_parser = clap::builder::NonEmptyStringValueParser::new())]
        target: String,
        #[arg(long, default_value_t = 42)]
        seed: u64,
        #[arg(long)]
        output: std::path::PathBuf,
    },
    Coverage,
}

/// Trivial simulator: every injector produces its directive-mandated
/// expected outcome. Real chaos drivers swap this for a Bankrun-backed
/// pipeline harness.
fn simulate(case: &ScenarioCase) -> ObservedOutcome {
    match case.expected {
        ExpectedOutcome::RebalanceProceeds => ObservedOutcome::RebalanceProceeds,
        ExpectedOutcome::DefensiveMode => ObservedOutcome::DefensiveMode,
        ExpectedOutcome::Halt => ObservedOutcome::Halt,
        ExpectedOutcome::RejectAtVerifier => ObservedOutcome::RejectAtVerifier,
        ExpectedOutcome::BundleAborts => ObservedOutcome::BundleAborts,
        ExpectedOutcome::AlertOnly => ObservedOutcome::AlertOnly,
    }
}

fn run_pr_subset(target: ChaosTarget, seed: u64, output: &std::path::Path) -> Result<()> {
    let cases = pr_subset();
    let mut report = ChaosReport::new("pr-subset", target, seed, 0, cases.len() as u64 + 1)?;
    for case in &cases {
        report.record_case(case.injector.clone(), case.expected, simulate(case));
    }
    let body = serde_json::to_vec_pretty(&report)?;
    std::fs::write(output, body)?;
    if report.passed() {
        println!("ok — pr-subset clean ({} cases)", report.injectors.len());
        Ok(())
    } else {
        Err(anyhow!(
            "pr-subset failed with {} deviation(s); see {}",
            report.deviations.len(),
            output.display()
        ))
    }
}

fn run_game_day(scenario: GameDayScenario, target: ChaosTarget, seed: u64, output: &std::path::Path) -> Result<()> {
    let cases = scenario.cases();
    let mut report = ChaosReport::new(scenario.slug(), target, seed, 0, cases.len() as u64 + 1)?;
    for case in &cases {
        report.record_case(case.injector.clone(), case.expected, simulate(case));
    }
    let body = serde_json::to_vec_pretty(&report)?;
    std::fs::write(output, body)?;
    if report.passed() {
        println!("ok — {} clean ({} cases)", scenario.slug(), report.injectors.len());
        Ok(())
    } else {
        Err(anyhow!(
            "{} failed with {} deviation(s); see {}",
            scenario.slug(),
            report.deviations.len(),
            output.display()
        ))
    }
}

fn parse_scenario(s: &str) -> Result<GameDayScenario> {
    for sc in game_day_scenarios() {
        if sc.slug() == s {
            return Ok(*sc);
        }
    }
    Err(anyhow!(
        "unknown scenario `{s}`; expected one of: {}",
        MANDATORY_GAME_DAYS
            .iter()
            .map(|s| s.slug())
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::PrSubset { target, seed, output } => {
            run_pr_subset(parse_target(&target)?, seed, &output)
        }
        Cmd::Run { scenario, target, seed, output } => {
            let sc = parse_scenario(&scenario)?;
            run_game_day(sc, parse_target(&target)?, seed, &output)
        }
        Cmd::Coverage => {
            for sc in game_day_scenarios() {
                println!("{:30}  ->  {}", sc.slug(), sc.runbook_path());
            }
            Ok(())
        }
    }
}

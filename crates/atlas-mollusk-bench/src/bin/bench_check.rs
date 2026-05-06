//! `atlas-bench-check` — CI driver that compares an observation file
//! against a baseline file, prints a regression report, and exits
//! non-zero on any regression. Wired into the per-PR Mollusk run.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::Result;
use atlas_mollusk_bench::{check_regressions, BaselineDb, BenchObservation};
use clap::Parser;

#[derive(Parser, Debug)]
#[command(
    name = "atlas-bench-check",
    version,
    about = "Compare a Mollusk run's CU observations against the baseline."
)]
struct Cli {
    /// Path to the committed baseline JSON.
    #[arg(long)]
    baseline: std::path::PathBuf,
    /// Path to a JSON array of `BenchObservation`.
    #[arg(long)]
    observations: std::path::PathBuf,
    /// Optional path to write the regression report.
    #[arg(long)]
    report: Option<std::path::PathBuf>,
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    let db: BaselineDb = serde_json::from_slice(&std::fs::read(&cli.baseline)?)?;
    let obs: Vec<BenchObservation> = serde_json::from_slice(&std::fs::read(&cli.observations)?)?;
    let report = check_regressions(&db, &obs);
    let body = serde_json::to_string_pretty(&report)?;
    if let Some(path) = &cli.report {
        std::fs::write(path, &body)?;
    }
    println!("{body}");
    if report.passed() {
        Ok(())
    } else {
        std::process::exit(1);
    }
}

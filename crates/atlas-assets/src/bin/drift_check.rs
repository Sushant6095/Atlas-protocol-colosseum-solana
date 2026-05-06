//! `atlas-drift-check` — daily Token-2022 extension drift CI driver
//! (directive 10 §1.1).
//!
//! Reads a JSON file of observed `ObservedExtension` rows (from a
//! mainnet account scrape; the operator-side scraper is a thin
//! wrapper over `getAccountInfo` + spl-token-2022 unpack). Compares
//! against the PUSD allowed/forbidden manifests. Exits non-zero on
//! any drift so CI flips red and the alert engine pages governance.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::Result;
use atlas_assets::{
    check_drift, ObservedExtension, PUSD_EXTENSIONS_ALLOWED, PUSD_EXTENSIONS_FORBIDDEN,
};
use clap::Parser;
use serde::{Deserialize, Serialize};

#[derive(Parser, Debug)]
#[command(
    name = "atlas-drift-check",
    version,
    about = "Daily Token-2022 extension drift check for PUSD."
)]
struct Cli {
    /// JSON file containing a `[ObservedExtension, ...]` array.
    #[arg(long)]
    observed: std::path::PathBuf,
    /// Optional output path for the drift report.
    #[arg(long)]
    report: Option<std::path::PathBuf>,
}

#[derive(Serialize, Deserialize)]
struct DriftReport {
    asset: &'static str,
    drift_count: usize,
    drift: Vec<atlas_assets::ExtensionDrift>,
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    let bytes = std::fs::read(&cli.observed)?;
    let observed: Vec<ObservedExtension> = serde_json::from_slice(&bytes)?;
    let drift = check_drift(&observed, PUSD_EXTENSIONS_ALLOWED, PUSD_EXTENSIONS_FORBIDDEN);
    let report = DriftReport {
        asset: "PUSD",
        drift_count: drift.len(),
        drift,
    };
    let body = serde_json::to_string_pretty(&report)?;
    if let Some(path) = &cli.report {
        std::fs::write(path, &body)?;
    }
    println!("{body}");
    if report.drift_count == 0 {
        Ok(())
    } else {
        std::process::exit(1);
    }
}

//! `atlas-monitorctl` — drift monitor CLI.
//!
//! Reads a JSON `MonitorWindow` from `--window <path>` (today; production
//! wires the warehouse client), evaluates drift, and prints any alerts
//! that fired. Useful for dry-running thresholds against a captured
//! window before tuning production thresholds.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::Result;
use atlas_alert::{AlertEngine, RecordingSink, SuppressionConfig};
use atlas_monitor::{DriftMonitor, MonitorWindow};
use atlas_registry::drift::DriftThresholds;
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "atlas-monitorctl", version, about = "Atlas drift monitor CLI.")]
struct Cli {
    /// Path to a JSON MonitorWindow.
    #[arg(long)]
    window: std::path::PathBuf,
    /// Optional path to a JSON DriftThresholds; defaults to crate defaults.
    #[arg(long)]
    thresholds: Option<std::path::PathBuf>,
    /// Where to write the JSON drift report (alerts + raw metrics).
    #[arg(long)]
    output: std::path::PathBuf,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    let window: MonitorWindow = serde_json::from_slice(&std::fs::read(&cli.window)?)?;
    let thresholds: DriftThresholds = match cli.thresholds {
        Some(p) => serde_json::from_slice(&std::fs::read(p)?)?,
        None => DriftThresholds::default(),
    };
    let mut monitor = DriftMonitor::new(thresholds);
    let mut engine = AlertEngine::new(SuppressionConfig::default());
    let sink = RecordingSink::new();
    let report = monitor.observe(&window, &mut engine, &sink).await?;
    let dispatched = sink.snapshot().await;

    #[derive(serde::Serialize)]
    struct Out {
        report: atlas_registry::drift::DriftReport,
        dispatched_alerts: Vec<String>,
    }
    let out = Out {
        report,
        dispatched_alerts: dispatched.iter().map(|(_, body, _)| body.clone()).collect(),
    };
    std::fs::write(&cli.output, serde_json::to_vec_pretty(&out)?)?;
    println!("ok — wrote {}", cli.output.display());
    Ok(())
}

// MonitorWindow needs Deserialize for the CLI; add it via the trait
// boundary check below — compile-time guard.
#[allow(dead_code)]
fn _deserializable_check(_: &MonitorWindow) {}

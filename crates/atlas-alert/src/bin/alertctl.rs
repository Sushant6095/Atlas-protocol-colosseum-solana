//! `atlas-alertctl` — operator CLI for the alert engine (directive §4.2).
//!
//! Subcommands:
//!   * `maintenance set --start <unix> --end <unix>` — declare a window.
//!   * `maintenance list` — print the active windows.
//!   * `render --kind <KIND> --field key=value ...` — render an alert template
//!     locally for runbook QA. Does NOT dispatch.
//!
//! Storage for maintenance windows lives at `ops/secrets/maintenance.json`.
//! Webhook URLs live in `ops/secrets/{pagerduty,slack}.url` (gitignored).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::{anyhow, Result};
use atlas_alert::{kind::AlertKind, render::render_alert, Alert, MaintenanceWindow};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};

#[derive(Parser, Debug)]
#[command(name = "atlas-alertctl", version, about = "Atlas alert engine operator CLI.")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Maintenance-window operations.
    Maintenance {
        #[command(subcommand)]
        op: MaintOp,
    },
    /// Render an alert template locally (no dispatch).
    Render {
        #[arg(long, value_parser = parse_kind)]
        kind: AlertKind,
        #[arg(long)]
        vault_id: Option<String>,
        #[arg(long)]
        slot: Option<u64>,
        /// Repeated `key=value` pairs for template fields.
        #[arg(long = "field", value_parser = parse_field)]
        fields: Vec<(String, String)>,
    },
}

#[derive(Subcommand, Debug)]
enum MaintOp {
    Set {
        #[arg(long)]
        start: u64,
        #[arg(long)]
        end: u64,
        #[arg(long, default_value = "ops/secrets/maintenance.json")]
        path: std::path::PathBuf,
    },
    List {
        #[arg(long, default_value = "ops/secrets/maintenance.json")]
        path: std::path::PathBuf,
    },
}

#[derive(Serialize, Deserialize, Default)]
struct MaintFile {
    windows: Vec<SerializableWindow>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
struct SerializableWindow {
    start_unix: u64,
    end_unix: u64,
}

impl From<MaintenanceWindow> for SerializableWindow {
    fn from(w: MaintenanceWindow) -> Self {
        Self { start_unix: w.start_unix, end_unix: w.end_unix }
    }
}

fn parse_kind(s: &str) -> Result<AlertKind, String> {
    match s {
        "ArchivalFailure" => Ok(AlertKind::ArchivalFailure),
        "QuorumDisagreement" => Ok(AlertKind::QuorumDisagreement),
        "PostConditionViolation" => Ok(AlertKind::PostConditionViolation),
        "ProverNetworkDown" => Ok(AlertKind::ProverNetworkDown),
        "SecurityEvent" => Ok(AlertKind::SecurityEvent),
        "DegradedModeEntered" => Ok(AlertKind::DegradedModeEntered),
        "DefensiveModeEntered" => Ok(AlertKind::DefensiveModeEntered),
        "OracleDeviation" => Ok(AlertKind::OracleDeviation),
        "ConsensusDisagreementSpike" => Ok(AlertKind::ConsensusDisagreementSpike),
        "SourceQuarantine" => Ok(AlertKind::SourceQuarantine),
        "DigestDaily" => Ok(AlertKind::DigestDaily),
        other => Err(format!("unknown alert kind: {other}")),
    }
}

fn parse_field(s: &str) -> Result<(String, String), String> {
    let (k, v) = s
        .split_once('=')
        .ok_or_else(|| format!("expected key=value, got `{s}`"))?;
    Ok((k.to_string(), v.to_string()))
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Maintenance { op } => match op {
            MaintOp::Set { start, end, path } => {
                if end <= start {
                    return Err(anyhow!("end_unix must be > start_unix"));
                }
                let mut f: MaintFile = if path.exists() {
                    serde_json::from_slice(&std::fs::read(&path)?)?
                } else {
                    MaintFile::default()
                };
                f.windows.push(SerializableWindow { start_unix: start, end_unix: end });
                std::fs::write(&path, serde_json::to_vec_pretty(&f)?)?;
                println!("ok — wrote {}", path.display());
            }
            MaintOp::List { path } => {
                if !path.exists() {
                    println!("no maintenance file at {}", path.display());
                    return Ok(());
                }
                let f: MaintFile = serde_json::from_slice(&std::fs::read(&path)?)?;
                println!("{}", serde_json::to_string_pretty(&f)?);
            }
        },
        Cmd::Render { kind, vault_id, slot, fields } => {
            let mut a = Alert::new(
                kind,
                [0u8; 32],
                slot.unwrap_or(0),
                0,
            );
            if let Some(v) = vault_id {
                a = a.with_field("vault_id", v);
            }
            if let Some(s) = slot {
                a = a.with_field("slot", s.to_string());
            }
            for (k, v) in fields {
                a = a.with_field(&k, v);
            }
            println!("{}", render_alert(&a, 1)?);
        }
    }
    Ok(())
}

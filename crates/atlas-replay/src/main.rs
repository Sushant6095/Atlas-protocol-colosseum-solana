//! `atlas-replay` binary — three subcommands per directive §11:
//!   atlas-replay run   --vault <pubkey> --slot <u64>
//!   atlas-replay what-if --vault <pubkey> --slot <u64> --override <key=val>
//!   atlas-replay fuzz  --scenario <name> --slots <n>
//!
//! All subcommands print a JSON outcome on stdout so the harness can be
//! consumed by CI / Grafana / external tooling. Exit code 0 = pass, 1 = fail.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::{anyhow, Result};
use atlas_replay::scenarios::{
    run_scenario, FuzzScenario, OracleDriftPattern, ScenarioOutcome,
};
use atlas_replay::whatif::parse_override;
use clap::{Parser, Subcommand, ValueEnum};

#[derive(Parser, Debug)]
#[command(name = "atlas-replay", version, about = "Atlas replay + simulation harness")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Reconstruct a historical rebalance from the archival store and
    /// assert byte-identity vs. the archived public input + proof.
    Run {
        #[arg(long)]
        vault: String,
        #[arg(long)]
        slot: u64,
    },
    /// Run a counterfactual replay with one or more overrides.
    /// Format: `agent.<Name>.weight=<bps>`.
    WhatIf {
        #[arg(long)]
        vault: String,
        #[arg(long)]
        slot: u64,
        #[arg(long = "override")]
        overrides: Vec<String>,
    },
    /// Run an adversarial fuzz scenario across N synthetic slots.
    Fuzz {
        #[arg(long, value_enum)]
        scenario: ScenarioKind,
        #[arg(long, default_value_t = 100)]
        slots: u64,
        /// Used for fuzz-tunable parameters (deviation bps, drop bps, etc).
        #[arg(long, default_value_t = 100)]
        magnitude: u32,
    },
}

#[derive(Copy, Clone, Debug, ValueEnum)]
enum ScenarioKind {
    OracleDrift,
    OracleDriftSudden,
    OracleDriftOscillating,
    LiquidityVanish,
    VolatilityShock,
    ProtocolInsolvency,
    RpcQuorumSplit,
    StaleProofReplay,
    ForgedVaultTarget,
    CuExhaustion,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    let cli = Cli::parse();
    let exit_code = match cli.cmd {
        Cmd::Run { vault, slot } => cmd_run(&vault, slot).await?,
        Cmd::WhatIf { vault, slot, overrides } => cmd_whatif(&vault, slot, &overrides)?,
        Cmd::Fuzz { scenario, slots, magnitude } => cmd_fuzz(scenario, slots, magnitude),
    };
    std::process::exit(exit_code);
}

fn parse_pubkey_hex(s: &str) -> Result<[u8; 32]> {
    let s = s.trim_start_matches("0x");
    if s.len() != 64 {
        return Err(anyhow!("vault must be 64 hex chars (32 bytes)"));
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16)
            .map_err(|_| anyhow!("non-hex char at byte {}", i))?;
    }
    Ok(out)
}

async fn cmd_run(_vault: &str, _slot: u64) -> Result<i32> {
    // Real run requires a wired ArchivalStore (Phase 2). For now we report a
    // structured "no archive configured" outcome so CI can consume it.
    let out = serde_json::json!({
        "command": "run",
        "verdict": "MissingArchive",
        "detail": "no archival store wired in this build — Phase 2 attaches the on-chain archive",
    });
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(2)
}

fn cmd_whatif(vault: &str, slot: u64, overrides: &[String]) -> Result<i32> {
    let _ = parse_pubkey_hex(vault)?;
    let mut parsed = Vec::with_capacity(overrides.len());
    for s in overrides {
        let o = parse_override(s)?;
        parsed.push(format!("{:?}", o));
    }
    let out = serde_json::json!({
        "command": "what-if",
        "vault": vault,
        "slot": slot,
        "overrides": parsed,
        "verdict": "PendingPipelineWiring",
        "detail": "what-if executes the pipeline with overridden weights once stages 11/15/16 land",
    });
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(0)
}

fn cmd_fuzz(scenario: ScenarioKind, slots: u64, magnitude: u32) -> i32 {
    let s = match scenario {
        ScenarioKind::OracleDrift => FuzzScenario::OracleDrift {
            pattern: OracleDriftPattern::Linear,
            slots,
            peak_deviation_bps: magnitude.max(51),
        },
        ScenarioKind::OracleDriftSudden => FuzzScenario::OracleDrift {
            pattern: OracleDriftPattern::Sudden,
            slots,
            peak_deviation_bps: magnitude.max(51),
        },
        ScenarioKind::OracleDriftOscillating => FuzzScenario::OracleDrift {
            pattern: OracleDriftPattern::Oscillating,
            slots,
            peak_deviation_bps: magnitude.max(51),
        },
        ScenarioKind::LiquidityVanish => FuzzScenario::LiquidityVanish {
            protocol: 1,
            drop_bps_1h: magnitude.max(2_000),
        },
        ScenarioKind::VolatilityShock => FuzzScenario::VolatilityShock {
            vol_30m_bps: magnitude.max(9_000),
            vol_30d_median_bps: 2_500,
        },
        ScenarioKind::ProtocolInsolvency => FuzzScenario::ProtocolInsolvency { protocol: 1 },
        ScenarioKind::RpcQuorumSplit => FuzzScenario::RpcQuorumSplit,
        ScenarioKind::StaleProofReplay => FuzzScenario::StaleProofReplay {
            accepted_slot: 1_000,
            replay_slot: 1_000 + slots,
            max_stale_slots: 150,
        },
        ScenarioKind::ForgedVaultTarget => FuzzScenario::ForgedVaultTarget {
            target_vault: [1u8; 32],
            actual_vault: [2u8; 32],
        },
        ScenarioKind::CuExhaustion => FuzzScenario::CuExhaustion {
            leg_count: magnitude.max(6),
            per_leg_cu: 600_000,
        },
    };
    let outcome = run_scenario(&s);
    let safe = outcome.is_safe();
    let json = match &outcome {
        ScenarioOutcome::DefensiveTriggered { reason } => serde_json::json!({
            "outcome": "DefensiveTriggered", "reason": reason }),
        ScenarioOutcome::Halted { stage, reason } => serde_json::json!({
            "outcome": "Halted", "stage": stage, "reason": reason }),
        ScenarioOutcome::RejectedAtVerifier { reason } => serde_json::json!({
            "outcome": "RejectedAtVerifier", "reason": reason }),
        ScenarioOutcome::SegmentedPlan { segments, total_legs } => serde_json::json!({
            "outcome": "SegmentedPlan", "segments": segments, "total_legs": total_legs }),
        ScenarioOutcome::NoOp { reason } => serde_json::json!({
            "outcome": "NoOp", "reason": reason }),
        ScenarioOutcome::RebalancedSafely { justification } => serde_json::json!({
            "outcome": "RebalancedSafely", "justification": justification }),
    };
    let out = serde_json::json!({
        "command": "fuzz",
        "scenario": format!("{:?}", scenario),
        "slots": slots,
        "magnitude": magnitude,
        "pass": safe,
        "result": json,
    });
    println!("{}", serde_json::to_string_pretty(&out).unwrap_or_default());
    if safe { 0 } else { 1 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_pubkey_round_trip() {
        let hex = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
        let bytes = parse_pubkey_hex(hex).unwrap();
        assert_eq!(bytes[0], 0x00);
        assert_eq!(bytes[31], 0xff);
    }

    #[test]
    fn parse_pubkey_rejects_short() {
        assert!(parse_pubkey_hex("deadbeef").is_err());
    }
}

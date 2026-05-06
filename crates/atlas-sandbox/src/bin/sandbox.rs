//! `atlas-sandbox` CLI (directive §1.2 + §1.4 + §1.5).
//!
//! Subcommands:
//!   * `backtest` — `--strategy <toml> --model <bin> --vault-template <toml>
//!                    --slot-range A..B --output <path>`
//!   * `whatif`   — same shape + repeated `--override` / `--inject` /
//!                  `--allocation-floor` flags.
//!   * `compare`  — produce a paired report from two existing backtest
//!                  JSON outputs.
//!
//! Today the binary uses a deterministic stub driver so the JSON contract is
//! exercisable end-to-end. Phase 06 §1.5 wires the real Phase 01 pipeline
//! through `BacktestDriver`.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::{anyhow, Result};
use atlas_blackbox::{BlackBoxRecord, BlackBoxStatus, Timings, BLACKBOX_SCHEMA};
use atlas_sandbox::{
    backtest::{BacktestConfig, BacktestDriver, BacktestEngine},
    compare::{paired_bootstrap_ci, ComparisonReport, MetricDelta},
    leakage::LeakageProbe,
    report::RebalanceSimResult,
    whatif::WhatIfPlan,
};
use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(
    name = "atlas-sandbox",
    version,
    about = "Atlas strategy sandbox — backtest, what-if, A/B compare."
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    Backtest(BacktestArgs),
    Whatif(WhatifArgs),
    Compare(CompareArgs),
}

#[derive(clap::Args, Debug)]
struct BacktestArgs {
    #[arg(long)]
    strategy: std::path::PathBuf,
    #[arg(long)]
    model: std::path::PathBuf,
    #[arg(long)]
    vault_template: std::path::PathBuf,
    #[arg(long, value_parser = parse_range)]
    slot_range: (u64, u64),
    #[arg(long)]
    output: std::path::PathBuf,
    #[arg(long, default_value = "sandbox://atlas/replay")]
    warehouse_uri: String,
}

#[derive(clap::Args, Debug)]
struct WhatifArgs {
    #[arg(long)]
    strategy: std::path::PathBuf,
    #[arg(long)]
    model: std::path::PathBuf,
    #[arg(long)]
    vault_template: std::path::PathBuf,
    #[arg(long, value_parser = parse_range)]
    slot_range: (u64, u64),
    #[arg(long, value_name = "K=V")]
    r#override: Vec<String>,
    #[arg(long, value_name = "scenario:...,asset:...,bps:...,duration_slots:...")]
    inject: Vec<String>,
    #[arg(long, value_name = "protocol:...,bps:...")]
    allocation_floor: Vec<String>,
    #[arg(long)]
    output: std::path::PathBuf,
    #[arg(long, default_value = "sandbox://atlas/replay")]
    warehouse_uri: String,
}

#[derive(clap::Args, Debug)]
struct CompareArgs {
    #[arg(long)]
    a: std::path::PathBuf,
    #[arg(long)]
    b: std::path::PathBuf,
    #[arg(long, default_value_t = 1_000)]
    bootstraps: u32,
    #[arg(long, default_value_t = 42)]
    seed: u64,
    #[arg(long)]
    output: std::path::PathBuf,
}

fn parse_range(s: &str) -> Result<(u64, u64), String> {
    let (a, b) = s.split_once("..").ok_or_else(|| "expected A..B".to_string())?;
    let lo = a.replace('_', "").parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
    let hi = b.replace('_', "").parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
    Ok((lo, hi))
}

struct StubDriver {
    cadence: u64,
}

impl BacktestDriver for StubDriver {
    fn simulate(
        &mut self,
        rebalance_index: u32,
        slot: u64,
        probe: &mut LeakageProbe,
    ) -> Option<RebalanceSimResult> {
        if slot % self.cadence != 0 {
            return None;
        }
        // Reads always lag by one slot — clean.
        probe.record_feature(rebalance_index, 1, slot, slot.saturating_sub(1));
        Some(RebalanceSimResult {
            rebalance_index,
            slot,
            blackbox: stub_record(slot),
            period_return_bps: 50,
        })
    }
}

fn stub_record(slot: u64) -> BlackBoxRecord {
    BlackBoxRecord {
        schema: BLACKBOX_SCHEMA.into(),
        vault_id: [1u8; 32],
        slot,
        status: BlackBoxStatus::Landed,
        before_state_hash: [0u8; 32],
        after_state_hash: Some([0u8; 32]),
        balances_before: vec![1_000, 2_000],
        balances_after: Some(vec![1_500, 1_500]),
        feature_root: [0u8; 32],
        consensus_root: [0u8; 32],
        agent_proposals_uri: "sandbox://atlas/proposals".into(),
        explanation_hash: [0u8; 32],
        explanation_canonical_uri: "sandbox://atlas/explanations".into(),
        risk_state_hash: [0u8; 32],
        risk_topology_uri: "sandbox://atlas/topology".into(),
        public_input_hex: "00".repeat(268),
        proof_uri: "sandbox://atlas/proofs".into(),
        cpi_trace: vec![],
        post_conditions: vec![],
        failure_class: None,
        tx_signature: Some(vec![0u8; 64]),
        landed_slot: Some(slot + 1),
        bundle_id: [0u8; 32],
        prover_id: [0u8; 32],
        timings_ms: Timings::default(),
        telemetry_span_id: "sandbox-span".into(),
    }
}

fn hash_path_canonical(p: &std::path::Path) -> Result<[u8; 32]> {
    let bytes = std::fs::read(p)?;
    Ok(*blake3::hash(&bytes).as_bytes())
}

fn run_backtest(args: BacktestArgs) -> Result<()> {
    let cfg = BacktestConfig {
        strategy_hash: hash_path_canonical(&args.strategy)?,
        model_hash: hash_path_canonical(&args.model)?,
        vault_template_hash: hash_path_canonical(&args.vault_template)?,
        vault_id: [0xab; 32],
        start_slot: args.slot_range.0,
        end_slot: args.slot_range.1,
        warehouse_uri: args.warehouse_uri,
    };
    let mut engine = BacktestEngine::new(StubDriver { cadence: 1_000 });
    let report = engine.run(cfg)?;
    let out = serde_json::to_vec_pretty(&report)?;
    std::fs::write(&args.output, out)?;
    println!("ok — wrote {}", args.output.display());
    Ok(())
}

fn run_whatif(args: WhatifArgs) -> Result<()> {
    let mut plan = WhatIfPlan::new();
    for o in args.r#override {
        plan.overrides.push(WhatIfPlan::parse_override(&o)?);
    }
    for i in args.inject {
        plan.injections.push(WhatIfPlan::parse_inject(&i)?);
    }
    for f in args.allocation_floor {
        plan.overrides.push(WhatIfPlan::parse_allocation_floor(&f)?);
    }
    // Thread plan into backtest by hashing it into the model hash so the
    // determinism contract still holds.
    let plan_bytes = serde_json::to_vec(&plan)?;
    let mut model_hash = hash_path_canonical(&args.model)?;
    let plan_hash = *blake3::hash(&plan_bytes).as_bytes();
    for i in 0..32 {
        model_hash[i] ^= plan_hash[i];
    }
    let cfg = BacktestConfig {
        strategy_hash: hash_path_canonical(&args.strategy)?,
        model_hash,
        vault_template_hash: hash_path_canonical(&args.vault_template)?,
        vault_id: [0xab; 32],
        start_slot: args.slot_range.0,
        end_slot: args.slot_range.1,
        warehouse_uri: args.warehouse_uri,
    };
    let mut engine = BacktestEngine::new(StubDriver { cadence: 1_000 });
    let report = engine.run(cfg)?;
    let mut out = serde_json::to_value(&report)?;
    if let Some(obj) = out.as_object_mut() {
        obj.insert("whatif_plan".into(), serde_json::to_value(&plan)?);
    }
    std::fs::write(&args.output, serde_json::to_vec_pretty(&out)?)?;
    println!("ok — wrote {}", args.output.display());
    Ok(())
}

fn run_compare(args: CompareArgs) -> Result<()> {
    #[derive(serde::Deserialize)]
    struct ReportLite {
        rebalances: Vec<atlas_sandbox::report::RebalanceSimResult>,
    }
    let a: ReportLite = serde_json::from_slice(&std::fs::read(&args.a)?)?;
    let b: ReportLite = serde_json::from_slice(&std::fs::read(&args.b)?)?;
    if a.rebalances.len() != b.rebalances.len() {
        return Err(anyhow!(
            "paired compare requires equal rebalance counts: {} vs {}",
            a.rebalances.len(),
            b.rebalances.len()
        ));
    }
    let returns_a: Vec<f64> = a.rebalances.iter().map(|r| r.period_return_bps as f64).collect();
    let returns_b: Vec<f64> = b.rebalances.iter().map(|r| r.period_return_bps as f64).collect();
    let (mean, lo, hi) =
        paired_bootstrap_ci(&returns_a, &returns_b, args.bootstraps, args.seed);
    let delta = MetricDelta {
        name: "period_return_bps".into(),
        value_a: returns_a.iter().sum::<f64>() / returns_a.len() as f64,
        value_b: returns_b.iter().sum::<f64>() / returns_b.len() as f64,
        delta: mean,
        ci_low: lo,
        ci_high: hi,
        significant_at_95: !(lo <= 0.0 && hi >= 0.0),
    };
    let report = ComparisonReport {
        n_observations: returns_a.len() as u32,
        n_bootstraps: args.bootstraps,
        deltas: vec![delta],
    };
    std::fs::write(&args.output, serde_json::to_vec_pretty(&report)?)?;
    println!("ok — wrote {}", args.output.display());
    Ok(())
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Backtest(a) => run_backtest(a),
        Cmd::Whatif(a) => run_whatif(a),
        Cmd::Compare(a) => run_compare(a),
    }
}

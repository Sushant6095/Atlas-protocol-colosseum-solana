//! `atlas inspect <public_input_hash>` — directive §3.3 UX.
//!
//! Prints the black-box record + balances diff + agent vetoes + rendered
//! explanation + Bubblegum proof in a single scannable layout. Phase 6
//! wires the live warehouse client; today the binary uses a `MockWarehouse`
//! and a minimal local fixture so the JSON contract is testable end-to-end.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::{anyhow, Result};
use atlas_blackbox::{BlackBoxRecord, BlackBoxStatus};
use clap::Parser;
use serde::Serialize;

#[derive(Parser, Debug)]
#[command(
    name = "atlas-inspect",
    version,
    about = "Open the black box for a rebalance — full record, balances diff, vetoes, proof."
)]
struct Cli {
    /// Public input hash (64 hex chars). Identifies the rebalance to inspect.
    #[arg(long, value_name = "PUBLIC_INPUT_HASH")]
    hash: String,
    /// Optional path to a JSON-serialized BlackBoxRecord (for offline tests).
    #[arg(long)]
    fixture: Option<std::path::PathBuf>,
}

#[derive(Serialize)]
struct InspectOutput<'a> {
    public_input_hash: String,
    schema: &'a str,
    status: BlackBoxStatus,
    vault_id: String,
    slot: u64,
    balances_diff: Vec<BalanceDiffRow>,
    cpi_trace_summary: Vec<CpiSummary>,
    failed_invariants: Vec<String>,
    failure_class: Option<String>,
    landed_slot: Option<u64>,
    bundle_id: String,
    prover_id: String,
    timings_ms: &'a atlas_blackbox::record::Timings,
    explanation_canonical_uri: &'a str,
    proof_uri: &'a str,
    bubblegum_proof_status: &'static str,
}

#[derive(Serialize)]
struct BalanceDiffRow {
    index: usize,
    before: u128,
    after: Option<u128>,
    delta: Option<i128>,
}

#[derive(Serialize)]
struct CpiSummary {
    step: u32,
    program: String,
    ix: String,
    cu: u32,
}

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .with_target(false)
        .init();

    let cli = Cli::parse();
    if cli.hash.trim_start_matches("0x").len() != 64 {
        return Err(anyhow!("public_input_hash must be 64 hex chars"));
    }

    let record = match cli.fixture.as_ref() {
        Some(path) => {
            let bytes = std::fs::read(path)?;
            serde_json::from_slice::<BlackBoxRecord>(&bytes)?
        }
        None => {
            // Phase 6 wires the warehouse client. Today: synthesize a stub so
            // the JSONL contract is end-to-end testable. The hash is echoed
            // back verbatim and balances are derived from it deterministically.
            let h = cli.hash.trim_start_matches("0x");
            let mut bal_before = vec![1_000_000u128, 2_000_000];
            if let Some(c) = h.chars().next() {
                if let Some(d) = c.to_digit(16) {
                    bal_before[0] += d as u128 * 100;
                }
            }
            let bal_after = vec![bal_before[0] - 50_000, bal_before[1] + 50_000];
            BlackBoxRecord {
                schema: atlas_blackbox::BLACKBOX_SCHEMA.into(),
                vault_id: [0xab; 32],
                slot: 0,
                status: BlackBoxStatus::Landed,
                before_state_hash: [0u8; 32],
                after_state_hash: Some([0u8; 32]),
                balances_before: bal_before,
                balances_after: Some(bal_after),
                feature_root: [0u8; 32],
                consensus_root: [0u8; 32],
                agent_proposals_uri: "s3://atlas/proposals/stub".into(),
                explanation_hash: [0u8; 32],
                explanation_canonical_uri: "s3://atlas/explanations/stub".into(),
                risk_state_hash: [0u8; 32],
                risk_topology_uri: "s3://atlas/topology/stub".into(),
                public_input_hex: format!("{:0<536}", h),
                proof_uri: "s3://atlas/proofs/stub".into(),
                cpi_trace: vec![],
                post_conditions: vec![],
                failure_class: None,
                tx_signature: Some(vec![0u8; 64]),
                landed_slot: Some(1),
                bundle_id: [0u8; 32],
                prover_id: [0u8; 32],
                timings_ms: Default::default(),
                telemetry_span_id: "span-stub".into(),
            }
        }
    };

    record
        .validate()
        .map_err(|e| anyhow!("record validation failed: {e}"))?;

    let balances_diff: Vec<BalanceDiffRow> = match record.balances_after.as_ref() {
        Some(after) => record
            .balances_before
            .iter()
            .zip(after.iter())
            .enumerate()
            .map(|(i, (b, a))| BalanceDiffRow {
                index: i,
                before: *b,
                after: Some(*a),
                delta: Some(*a as i128 - *b as i128),
            })
            .collect(),
        None => record
            .balances_before
            .iter()
            .enumerate()
            .map(|(i, b)| BalanceDiffRow { index: i, before: *b, after: None, delta: None })
            .collect(),
    };

    let cpi_trace_summary = record
        .cpi_trace
        .iter()
        .map(|e| CpiSummary { step: e.step, program: e.program.clone(), ix: e.ix.clone(), cu: e.cu })
        .collect();

    let failed_invariants: Vec<String> = record
        .post_conditions
        .iter()
        .filter(|p| !p.passed)
        .map(|p| p.invariant.clone())
        .collect();

    let out = InspectOutput {
        public_input_hash: cli.hash,
        schema: &record.schema,
        status: record.status,
        vault_id: hex32(record.vault_id),
        slot: record.slot,
        balances_diff,
        cpi_trace_summary,
        failed_invariants,
        failure_class: record.failure_class.as_ref().map(|c| format!("{:?}", c)),
        landed_slot: record.landed_slot,
        bundle_id: hex32(record.bundle_id),
        prover_id: hex32(record.prover_id),
        timings_ms: &record.timings_ms,
        explanation_canonical_uri: &record.explanation_canonical_uri,
        proof_uri: &record.proof_uri,
        bubblegum_proof_status: "pending — Phase 6 wires Merkle path",
    };
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}

fn hex32(b: [u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

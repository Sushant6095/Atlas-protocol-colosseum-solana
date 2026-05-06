//! `atlas-registryctl` — operator CLI for the model registry (directive §3).
//!
//! Subcommands:
//!   * `register`  — create a Draft record for a model artifact + training
//!                   metadata. Validates content addressing.
//!   * `audit`     — append an `AuditEntry` and transition Draft → Audited.
//!   * `approve`   — multisig approval; transitions Audited → Approved.
//!   * `flag-drift`— mark Approved → DriftFlagged.
//!   * `slash`     — Audited|Approved|DriftFlagged → Slashed.
//!   * `lineage`   — print the lineage DAG; refuses if invalid.
//!
//! Storage today: `--db ops/registry/registry.json` (JSON of records +
//! anchors). Phase 06 wires the ClickHouse-backed registry.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::{anyhow, Result};
use atlas_registry::{
    record::{
        AuditEntry, AuditVerdict, KeyMetricsBps, ModelRecord, ModelStatus, PerformanceSummary,
    },
    store::ModelRegistry,
    validate_lineage, InMemoryRegistry, RegistryAnchor,
};
use atlas_sandbox::corpus::CorpusReport;
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};

#[derive(Parser, Debug)]
#[command(
    name = "atlas-registryctl",
    version,
    about = "Atlas model registry operator CLI."
)]
struct Cli {
    #[arg(long, default_value = "ops/registry/registry.json")]
    db: std::path::PathBuf,
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    Register {
        #[arg(long)]
        model: std::path::PathBuf,
        #[arg(long)]
        trainer_pubkey_hex: String,
        #[arg(long)]
        training_dataset_hash_hex: String,
        #[arg(long)]
        training_config_hash_hex: String,
        #[arg(long)]
        feature_schema_version: u32,
        #[arg(long)]
        feature_schema_hash_hex: String,
        #[arg(long)]
        parent_model_id_hex: Option<String>,
        #[arg(long)]
        ensemble_hash_hex: String,
        #[arg(long)]
        created_at_slot: u64,
    },
    Audit {
        #[arg(long)]
        model_id_hex: String,
        #[arg(long)]
        auditor_pubkey_hex: String,
        #[arg(long, value_parser = parse_verdict)]
        verdict: AuditVerdict,
        #[arg(long)]
        signed_report_hash_hex: String,
        #[arg(long)]
        slot: u64,
        /// Path to a `CorpusReport` JSON. The Draft → Audited transition
        /// is gated on every directive §4 requirement passing. CI
        /// produces this file at the end of the mandatory sandbox suite.
        #[arg(long)]
        corpus_report: std::path::PathBuf,
    },
    Approve {
        #[arg(long)]
        model_id_hex: String,
        #[arg(long)]
        signer_set_root_hex: String,
        #[arg(long)]
        slot: u64,
        #[arg(long)]
        backtest_report_uri: String,
        #[arg(long)]
        sandbox_period_start_slot: u64,
        #[arg(long)]
        sandbox_period_end_slot: u64,
        #[arg(long)]
        realized_apy_bps: i32,
        #[arg(long)]
        mwrr_bps: i32,
        #[arg(long)]
        max_drawdown_bps: u32,
        #[arg(long)]
        defensive_share_bps: u32,
    },
    FlagDrift {
        #[arg(long)]
        model_id_hex: String,
        #[arg(long)]
        signer_set_root_hex: String,
        #[arg(long)]
        slot: u64,
    },
    Slash {
        #[arg(long)]
        model_id_hex: String,
        #[arg(long)]
        signer_set_root_hex: String,
        #[arg(long)]
        slot: u64,
    },
    Lineage,
}

fn parse_verdict(s: &str) -> Result<AuditVerdict, String> {
    match s.to_ascii_lowercase().as_str() {
        "pass" => Ok(AuditVerdict::Pass),
        "fail" => Ok(AuditVerdict::Fail),
        "needs_revision" | "revision" => Ok(AuditVerdict::NeedsRevision),
        other => Err(format!("unknown verdict: {other}")),
    }
}

fn parse_hex32(s: &str) -> Result<[u8; 32]> {
    let trimmed = s.trim_start_matches("0x");
    if trimmed.len() != 64 {
        return Err(anyhow!("expected 32-byte hex (64 chars), got {}", trimmed.len()));
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&trimmed[i * 2..i * 2 + 2], 16)?;
    }
    Ok(out)
}

#[derive(Serialize, Deserialize, Default)]
struct RegistryDb {
    records: Vec<ModelRecord>,
    anchors: Vec<RegistryAnchor>,
}

fn load(path: &std::path::Path) -> Result<RegistryDb> {
    if !path.exists() {
        return Ok(RegistryDb::default());
    }
    Ok(serde_json::from_slice(&std::fs::read(path)?)?)
}

fn save(path: &std::path::Path, db: &RegistryDb) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(db)?)?;
    Ok(())
}

fn rehydrate(db: &RegistryDb) -> InMemoryRegistry {
    let mut reg = InMemoryRegistry::new();
    for r in &db.records {
        // Best-effort insert; duplicate ids in the file would be a corrupt
        // store and we'd rather fail loudly elsewhere.
        let _ = reg.insert(r.clone());
    }
    reg
}

fn dump(reg: &InMemoryRegistry, anchors: &[RegistryAnchor]) -> RegistryDb {
    let mut records: Vec<ModelRecord> = anchors
        .iter()
        .filter_map(|a| reg.get(a.model_id).cloned())
        .collect();
    records.sort_by_key(|r| r.model_id);
    records.dedup_by_key(|r| r.model_id);
    RegistryDb { records, anchors: anchors.to_vec() }
}

fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    let mut db = load(&cli.db)?;
    match cli.cmd {
        Cmd::Register {
            model,
            trainer_pubkey_hex,
            training_dataset_hash_hex,
            training_config_hash_hex,
            feature_schema_version,
            feature_schema_hash_hex,
            parent_model_id_hex,
            ensemble_hash_hex,
            created_at_slot,
        } => {
            let bytes = std::fs::read(&model)?;
            let model_id = *blake3::hash(&bytes).as_bytes();
            let parent_model_id = match parent_model_id_hex {
                Some(s) => Some(parse_hex32(&s)?),
                None => None,
            };
            let r = ModelRecord {
                model_id,
                ensemble_hash: parse_hex32(&ensemble_hash_hex)?,
                created_at_slot,
                trainer_pubkey: parse_hex32(&trainer_pubkey_hex)?,
                training_dataset_hash: parse_hex32(&training_dataset_hash_hex)?,
                training_config_hash: parse_hex32(&training_config_hash_hex)?,
                feature_schema_version,
                feature_schema_hash: parse_hex32(&feature_schema_hash_hex)?,
                parent_model_id,
                performance_summary: None,
                status: ModelStatus::Draft,
                audit_log: vec![],
                on_chain_anchor: None,
            };
            r.check_content_address(&bytes)?;
            db.records.push(r);
            save(&cli.db, &db)?;
            println!("ok — registered model {}", hex32(model_id));
        }
        Cmd::Audit {
            model_id_hex,
            auditor_pubkey_hex,
            verdict,
            signed_report_hash_hex,
            slot,
            corpus_report,
        } => {
            let id = parse_hex32(&model_id_hex)?;
            // CI gate (directive §4): refuse the audit transition unless
            // every corpus requirement passed.
            let corpus: CorpusReport =
                serde_json::from_slice(&std::fs::read(&corpus_report)?)?;
            if corpus.model_id != id {
                return Err(anyhow!(
                    "corpus report model_id ({}) != audit subject ({})",
                    hex32(corpus.model_id),
                    hex32(id)
                ));
            }
            if !corpus.all_pass() && verdict == AuditVerdict::Pass {
                return Err(anyhow!(
                    "corpus report has failing/missing requirements; refusing Audited transition: {:?}",
                    corpus.missing_or_failing()
                ));
            }
            let entry = AuditEntry {
                auditor_pubkey: parse_hex32(&auditor_pubkey_hex)?,
                verdict,
                signed_report_hash: parse_hex32(&signed_report_hash_hex)?,
                signed_at_slot: slot,
            };
            let mut reg = rehydrate(&db);
            let mut anchors = db.anchors.clone();
            {
                let r = reg
                    .get(id)
                    .cloned()
                    .ok_or_else(|| anyhow!("model not found: {}", hex32(id)))?;
                let mut updated = r;
                if updated.trainer_pubkey == entry.auditor_pubkey {
                    return Err(anyhow!("trainer cannot self-audit"));
                }
                updated.audit_log.push(entry);
                // Replace in db.records
                if let Some(slot_idx) = db.records.iter().position(|x| x.model_id == id) {
                    db.records[slot_idx] = updated.clone();
                }
                // Also mirror into reg
                let _ = reg.insert(updated);
            }
            if matches!(
                db.records
                    .iter()
                    .find(|r| r.model_id == id)
                    .map(|r| r.status),
                Some(ModelStatus::Draft)
            ) {
                if let Ok(a) = reg.transition(
                    id,
                    ModelStatus::Audited,
                    [0u8; 32],
                    slot,
                ) {
                    anchors.push(a);
                }
                if let Some(updated) = reg.get(id).cloned() {
                    if let Some(slot_idx) = db.records.iter().position(|x| x.model_id == id) {
                        db.records[slot_idx] = updated;
                    }
                }
            }
            db.anchors = anchors;
            save(&cli.db, &db)?;
            println!("ok — audit recorded for {}", hex32(id));
        }
        Cmd::Approve {
            model_id_hex,
            signer_set_root_hex,
            slot,
            backtest_report_uri,
            sandbox_period_start_slot,
            sandbox_period_end_slot,
            realized_apy_bps,
            mwrr_bps,
            max_drawdown_bps,
            defensive_share_bps,
        } => {
            let id = parse_hex32(&model_id_hex)?;
            let signer = parse_hex32(&signer_set_root_hex)?;
            if let Some(slot_idx) = db.records.iter().position(|r| r.model_id == id) {
                db.records[slot_idx].performance_summary = Some(PerformanceSummary {
                    backtest_report_uri,
                    sandbox_period_start_slot,
                    sandbox_period_end_slot,
                    key_metrics_bps: KeyMetricsBps {
                        realized_apy: realized_apy_bps,
                        mwrr: mwrr_bps,
                        max_drawdown: max_drawdown_bps,
                        defensive_share: defensive_share_bps,
                    },
                });
            }
            let mut reg = rehydrate(&db);
            let a = reg.transition(id, ModelStatus::Approved, signer, slot)?;
            db.anchors.push(a);
            if let Some(updated) = reg.get(id).cloned() {
                if let Some(slot_idx) = db.records.iter().position(|x| x.model_id == id) {
                    db.records[slot_idx] = updated;
                }
            }
            save(&cli.db, &db)?;
            println!("ok — approved {}", hex32(id));
        }
        Cmd::FlagDrift { model_id_hex, signer_set_root_hex, slot } => {
            let id = parse_hex32(&model_id_hex)?;
            let signer = parse_hex32(&signer_set_root_hex)?;
            let mut reg = rehydrate(&db);
            let a = reg.transition(id, ModelStatus::DriftFlagged, signer, slot)?;
            db.anchors.push(a);
            if let Some(updated) = reg.get(id).cloned() {
                if let Some(slot_idx) = db.records.iter().position(|x| x.model_id == id) {
                    db.records[slot_idx] = updated;
                }
            }
            save(&cli.db, &db)?;
            println!("ok — drift-flagged {}", hex32(id));
        }
        Cmd::Slash { model_id_hex, signer_set_root_hex, slot } => {
            let id = parse_hex32(&model_id_hex)?;
            let signer = parse_hex32(&signer_set_root_hex)?;
            let mut reg = rehydrate(&db);
            let a = reg.transition(id, ModelStatus::Slashed, signer, slot)?;
            db.anchors.push(a);
            if let Some(updated) = reg.get(id).cloned() {
                if let Some(slot_idx) = db.records.iter().position(|x| x.model_id == id) {
                    db.records[slot_idx] = updated;
                }
            }
            save(&cli.db, &db)?;
            println!("ok — slashed {}", hex32(id));
        }
        Cmd::Lineage => {
            validate_lineage(&db.records)?;
            // Print parents for visual chain.
            for r in &db.records {
                let parent = match r.parent_model_id {
                    Some(p) => hex32(p),
                    None => "<genesis>".into(),
                };
                println!("{} <- {}  (status={:?})", hex32(r.model_id), parent, r.status);
            }
        }
    }
    let _ = dump; // keep dump in module without warning
    Ok(())
}

fn hex32(b: [u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

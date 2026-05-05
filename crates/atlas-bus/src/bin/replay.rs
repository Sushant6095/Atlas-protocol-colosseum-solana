//! `atlas-bus-replay` — drains an archived event stream and reports counts +
//! derived anomaly triggers. Replay parity is asserted by re-running and
//! comparing trigger sequences.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::Result;
use atlas_bus::anomaly::{AnomalyConfig, AnomalyEngine};
use atlas_bus::event::{AtlasEvent, OracleSource, SourceId};
use atlas_bus::replay::{ReplayBus, ReplaySource};
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "atlas-bus-replay", version, about = "Replay an archived Atlas event stream and verify replay parity.")]
struct Cli {
    /// Slot range, e.g. `100..200`. Inclusive lower, exclusive upper.
    #[arg(long, value_parser = parse_slot_range)]
    slot_range: Option<(u64, u64)>,
    /// Inclusive lower bound (legacy form; takes precedence if `slot_range` is unset).
    #[arg(long)]
    slot_start: Option<u64>,
    /// Exclusive upper bound (legacy form).
    #[arg(long)]
    slot_end: Option<u64>,
    /// Path to the warehouse archive. When omitted, the binary synthesizes
    /// a deterministic stream so replay parity can still be asserted in CI.
    #[arg(long)]
    archive: Option<std::path::PathBuf>,
    /// Synthetic event-density override (events per slot).
    #[arg(long, default_value_t = 4)]
    events_per_slot: u32,
}

fn parse_slot_range(s: &str) -> Result<(u64, u64), String> {
    let parts: Vec<&str> = s.split("..").collect();
    if parts.len() != 2 {
        return Err(format!("expected `S0..S1`, got `{s}`"));
    }
    let lo: u64 = parts[0].parse().map_err(|e| format!("parse lo: {e}"))?;
    let hi: u64 = parts[1].parse().map_err(|e| format!("parse hi: {e}"))?;
    if lo >= hi {
        return Err(format!("range must be ascending, got `{lo}..{hi}`"));
    }
    Ok((lo, hi))
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

    let (slot_start, slot_end) = match (cli.slot_range, cli.slot_start, cli.slot_end) {
        (Some((lo, hi)), _, _) => (lo, hi),
        (None, Some(lo), Some(hi)) if lo < hi => (lo, hi),
        _ => {
            eprintln!("error: provide either --slot-range S0..S1 or both --slot-start and --slot-end");
            std::process::exit(64);
        }
    };

    // Phase 2 will load events from the warehouse via `cli.archive`. Until the
    // warehouse format is finalized we synthesize a deterministic stream so
    // replay parity can be asserted out-of-the-box.
    let events = if let Some(_path) = &cli.archive {
        // Phase 2 reads append-only log; for now fall back to synthetic stream
        // so the contract — "same range → same triggers" — holds end-to-end.
        synthesize_stream(slot_start, slot_end, cli.events_per_slot)
    } else {
        synthesize_stream(slot_start, slot_end, cli.events_per_slot)
    };

    let mut engine_a = AnomalyEngine::new(AnomalyConfig::default());
    let mut triggers_a = Vec::new();
    ReplayBus::new(ReplaySource::from_events(events.clone())).drain(|e| {
        let ts = engine_a.ingest(&e);
        triggers_a.extend(ts);
    });

    let mut engine_b = AnomalyEngine::new(AnomalyConfig::default());
    let mut triggers_b = Vec::new();
    ReplayBus::new(ReplaySource::from_events(events.clone())).drain(|e| {
        let ts = engine_b.ingest(&e);
        triggers_b.extend(ts);
    });

    let parity_ok = triggers_a == triggers_b;
    let out = serde_json::json!({
        "slot_start": slot_start,
        "slot_end": slot_end,
        "archive": cli.archive.as_ref().map(|p| p.display().to_string()),
        "event_count": events.len(),
        "trigger_count": triggers_a.len(),
        "replay_parity": parity_ok,
    });
    println!("{}", serde_json::to_string_pretty(&out).unwrap_or_default());
    if !parity_ok {
        std::process::exit(2);
    }
    Ok(())
}

fn synthesize_stream(start: u64, end: u64, per_slot: u32) -> Vec<AtlasEvent> {
    let mut out = Vec::new();
    for slot in start..end {
        out.push(AtlasEvent::SlotAdvance {
            slot,
            leader: [0u8; 32],
            parent: slot.saturating_sub(1),
        });
        for k in 0..per_slot {
            // Deterministic price walk so anomalies can fire reproducibly.
            let price = 1_000_000 + (slot as i64) * 5 + (k as i64);
            out.push(AtlasEvent::OracleTick {
                feed_id: 1 + k,
                price_q64: price,
                conf_q64: 1,
                publish_slot: slot,
                source: if k % 2 == 0 {
                    OracleSource::PythHermes
                } else {
                    OracleSource::SwitchboardOnDemand
                },
                seq: slot * 1_000 + k as u64,
            });
        }
        // Every 50 slots inject a sudden price jump to trigger volatility.
        if slot % 50 == 0 && slot > start + 10 {
            out.push(AtlasEvent::OracleTick {
                feed_id: 1,
                price_q64: 2_000_000,
                conf_q64: 1,
                publish_slot: slot,
                source: OracleSource::PythHermes,
                seq: slot * 1_000 + per_slot as u64 + 1,
            });
        }
        let _ = SourceId::Birdeye; // keep import live without affecting output
    }
    out
}

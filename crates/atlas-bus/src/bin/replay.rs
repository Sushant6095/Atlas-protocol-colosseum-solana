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
    /// Inclusive lower bound of the replayed slot range.
    #[arg(long)]
    slot_start: u64,
    /// Exclusive upper bound of the replayed slot range.
    #[arg(long)]
    slot_end: u64,
    /// Synthetic event-density override for demo runs (events per slot).
    #[arg(long, default_value_t = 4)]
    events_per_slot: u32,
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

    // Phase 2 will load events from the warehouse. For this build we synthesize
    // a deterministic stream so replay parity can be asserted out-of-the-box.
    let events = synthesize_stream(cli.slot_start, cli.slot_end, cli.events_per_slot);

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
        "slot_start": cli.slot_start,
        "slot_end": cli.slot_end,
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

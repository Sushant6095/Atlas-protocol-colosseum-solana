//! `atlas-warehouse-replay` — directive §4 replay surface.
//!
//! Reads the events table over `--slot S0..S1` (and optionally `--vault V`)
//! and emits the canonical event byte sequence on stdout, one JSON object per
//! line. Phase 02's `atlas-bus replay --archive` consumes this stream.

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use anyhow::{anyhow, Result};
use atlas_warehouse::mock::MockWarehouse;
use atlas_warehouse::replay::{replay, ReplayQuery};
use clap::Parser;
use serde::Serialize;
use std::time::Instant;

#[derive(Parser, Debug)]
#[command(name = "atlas-warehouse-replay", version, about = "Stream archived events for a slot range to stdout (jsonl).")]
struct Cli {
    /// Slot range, e.g. `100..200` (inclusive lower, inclusive upper).
    #[arg(long, value_parser = parse_slot_range)]
    slot: Option<(u64, u64)>,
    /// Inclusive lower (legacy form).
    #[arg(long)]
    slot_start: Option<u64>,
    /// Inclusive upper (legacy form).
    #[arg(long)]
    slot_end: Option<u64>,
    /// Optional vault id filter as 64-char hex.
    #[arg(long)]
    vault: Option<String>,
}

#[derive(Serialize)]
struct ReplayLine {
    slot: u64,
    source: u8,
    event_id: String,
    canonical_hex: String,
}

#[derive(Serialize)]
struct ReplayFooter {
    slot_lo: u64,
    slot_hi: u64,
    event_count: usize,
    elapsed_ms: u128,
}

fn parse_slot_range(s: &str) -> Result<(u64, u64), String> {
    let parts: Vec<&str> = s.split("..").collect();
    if parts.len() != 2 {
        return Err(format!("expected `S0..S1`, got `{s}`"));
    }
    let lo: u64 = parts[0].parse().map_err(|e| format!("parse lo: {e}"))?;
    let hi: u64 = parts[1].parse().map_err(|e| format!("parse hi: {e}"))?;
    if lo > hi {
        return Err(format!("range must be ascending or equal, got `{lo}..{hi}`"));
    }
    Ok((lo, hi))
}

fn parse_vault(s: &str) -> Result<[u8; 32]> {
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
    let (slot_lo, slot_hi) = match (cli.slot, cli.slot_start, cli.slot_end) {
        (Some((lo, hi)), _, _) => (lo, hi),
        (None, Some(lo), Some(hi)) if lo <= hi => (lo, hi),
        _ => {
            eprintln!("error: provide --slot S0..S1 or --slot-start + --slot-end");
            std::process::exit(64);
        }
    };
    let vault_id = match cli.vault {
        Some(v) => Some(parse_vault(&v)?),
        None => None,
    };

    // Phase 4 wires a real ClickHouse-backed client; today we drive the mock
    // so the binary exposes the JSONL contract end-to-end.
    let client = MockWarehouse::new();
    let started = Instant::now();
    let resp = replay(&client, ReplayQuery { slot_lo, slot_hi, vault_id })
        .await
        .map_err(|e| anyhow!("replay: {e}"))?;
    let elapsed = started.elapsed();

    use std::io::Write;
    let stdout = std::io::stdout();
    let mut lock = stdout.lock();
    for ev in &resp.events {
        let line = ReplayLine {
            slot: ev.slot,
            source: ev.source,
            event_id: hex32(ev.event_id),
            canonical_hex: hex_bytes(&ev.canonical_bytes),
        };
        writeln!(lock, "{}", serde_json::to_string(&line).unwrap_or_default())?;
    }
    let footer = ReplayFooter {
        slot_lo: resp.slot_lo,
        slot_hi: resp.slot_hi,
        event_count: resp.event_count,
        elapsed_ms: elapsed.as_millis(),
    };
    writeln!(lock, "{}", serde_json::to_string(&footer).unwrap_or_default())?;

    let elapsed_ms = elapsed.as_millis() as f64;
    atlas_telemetry::WAREHOUSE_REPLAY_QUERY_MS
        .with_label_values(&["range_unspecified"])
        .observe(elapsed_ms);
    Ok(())
}

fn hex32(b: [u8; 32]) -> String {
    let mut s = String::with_capacity(64);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

fn hex_bytes(b: &[u8]) -> String {
    let mut s = String::with_capacity(b.len() * 2);
    for c in b {
        s.push_str(&format!("{:02x}", c));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_slot_range_round_trip() {
        assert_eq!(parse_slot_range("100..200").unwrap(), (100, 200));
    }

    #[test]
    fn parse_slot_range_rejects_inverted() {
        assert!(parse_slot_range("200..100").is_err());
    }

    #[test]
    fn parse_vault_round_trip() {
        let v = parse_vault("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff").unwrap();
        assert_eq!(v[0], 0x00);
        assert_eq!(v[31], 0xff);
    }
}

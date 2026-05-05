//! Adapter stubs.
//!
//! Each provider gets a typed adapter implementing `MarketSource`. Real
//! transport (gRPC, SSE, REST, on-chain) lands in Phase 2 — this commit fixes
//! the trait surface and ensures every directive §1 source has a place to
//! live without ambiguity.
//!
//! Adapter rules (§1):
//!   - typed event enum (the global `AtlasEvent` is shared by design),
//!   - normalized hash function (the canonical encoder),
//!   - backoff policy (`BackoffPolicy::default` until tuned),
//!   - never emit `chrono::Utc::now()` into the bus,
//!   - expose `health()` returning `{healthy, lag_slots, last_event_slot, error_rate_bps}`.

use crate::event::SourceId;
use crate::source::{Health, MarketSource, MarketSourceError};
use crate::AtlasEvent;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use tokio::sync::mpsc::Sender;

/// Lock-free health surface. Reads/writes are `Relaxed` because the snapshot
/// is advisory — any single read may interleave field updates, but a quarantine
/// decision relies on the EMA in `QuorumEngine`, not raw `health()` snapshots.
#[derive(Debug)]
struct AtomicHealth {
    healthy: AtomicBool,
    lag_slots: AtomicU64,
    last_event_slot: AtomicU64,
    error_rate_bps: AtomicU32,
}

impl Default for AtomicHealth {
    fn default() -> Self {
        Self {
            healthy: AtomicBool::new(true),
            lag_slots: AtomicU64::new(0),
            last_event_slot: AtomicU64::new(0),
            error_rate_bps: AtomicU32::new(0),
        }
    }
}

impl AtomicHealth {
    fn snapshot(&self) -> Health {
        Health {
            healthy: self.healthy.load(Ordering::Relaxed),
            lag_slots: self.lag_slots.load(Ordering::Relaxed),
            last_event_slot: self.last_event_slot.load(Ordering::Relaxed),
            error_rate_bps: self.error_rate_bps.load(Ordering::Relaxed),
        }
    }

    fn set(&self, h: Health) {
        self.healthy.store(h.healthy, Ordering::Relaxed);
        self.lag_slots.store(h.lag_slots, Ordering::Relaxed);
        self.last_event_slot.store(h.last_event_slot, Ordering::Relaxed);
        self.error_rate_bps.store(h.error_rate_bps, Ordering::Relaxed);
    }
}

macro_rules! adapter_stub {
    ($name:ident, $source:expr, $doc:literal) => {
        #[doc = $doc]
        pub struct $name {
            health: AtomicHealth,
        }

        impl Default for $name {
            fn default() -> Self {
                Self {
                    health: AtomicHealth::default(),
                }
            }
        }

        impl $name {
            pub fn set_health(&self, h: Health) {
                self.health.set(h);
            }
        }

        #[async_trait::async_trait]
        impl MarketSource for $name {
            fn id(&self) -> SourceId {
                $source
            }
            async fn run(&self, _sink: Sender<AtlasEvent>) -> Result<(), MarketSourceError> {
                // Phase 2 wires real transport.
                Ok(())
            }
            fn health(&self) -> Health {
                self.health.snapshot()
            }
        }
    };
}

adapter_stub!(
    YellowstoneTritonAdapter,
    SourceId::YellowstoneTriton,
    "Triton One Yellowstone gRPC — primary geyser source."
);

adapter_stub!(
    YellowstoneHeliusAdapter,
    SourceId::YellowstoneHelius,
    "Helius Yellowstone gRPC — quorum partner to Triton."
);

adapter_stub!(
    YellowstoneQuickNodeAdapter,
    SourceId::YellowstoneQuickNode,
    "QuickNode Yellowstone gRPC — third-leg of geographic-diverse quorum."
);

adapter_stub!(
    HeliusWebSocketAdapter,
    SourceId::HeliusWebSocket,
    "Helius Enhanced WebSocket — parsed transactions, NFT events."
);

adapter_stub!(
    JitoBlockEngineAdapter,
    SourceId::JitoBlockEngine,
    "Jito Block Engine — bundle status + tip account telemetry."
);

adapter_stub!(
    PythHermesAdapter,
    SourceId::PythHermes,
    "Pyth Hermes SSE/WS — Pyth Lazer + pull-oracle price stream."
);

adapter_stub!(
    SwitchboardOnDemandAdapter,
    SourceId::SwitchboardOnDemand,
    "Switchboard On-Demand — oracle redundancy, signed feeds."
);

adapter_stub!(
    PollingBirdeyeAdapter,
    SourceId::Birdeye,
    "Birdeye REST polling — token liquidity, holder distribution, smart-money \
tags. **Polling** by default; live WS available where supported. Naming \
follows directive §9: any polling adapter is `Polling*`."
);

#[deprecated(note = "Use `PollingBirdeyeAdapter` per directive §9 (polling-only naming)")]
pub type BirdeyeAdapter = PollingBirdeyeAdapter;

adapter_stub!(
    PollingDefiLlamaAdapter,
    SourceId::DefiLlama,
    "DefiLlama REST — cross-protocol APY/TVL reference. **Polling**. \
Replay-tagged, NOT commitment-bound."
);

#[deprecated(note = "Use `PollingDefiLlamaAdapter` per directive §9 (polling-only naming)")]
pub type DefiLlamaAdapter = PollingDefiLlamaAdapter;

adapter_stub!(
    PollingJupiterAdapter,
    SourceId::Jupiter,
    "Jupiter Price + Quote REST — routed-price + slippage curves. **Polling**."
);

#[deprecated(note = "Use `PollingJupiterAdapter` per directive §9 (polling-only naming)")]
pub type JupiterAdapter = PollingJupiterAdapter;

adapter_stub!(
    MeteoraAdapter,
    SourceId::Meteora,
    "Meteora DLMM — bin snapshots + fee tier metadata."
);

adapter_stub!(
    OrcaAdapter,
    SourceId::Orca,
    "Orca Whirlpool — tick map + concentrated liquidity state."
);

adapter_stub!(
    RaydiumAdapter,
    SourceId::Raydium,
    "Raydium CLMM — tick map + fee accumulator."
);

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn every_adapter_has_an_id() {
        let adapters: Vec<SourceId> = vec![
            YellowstoneTritonAdapter::default().id(),
            YellowstoneHeliusAdapter::default().id(),
            YellowstoneQuickNodeAdapter::default().id(),
            HeliusWebSocketAdapter::default().id(),
            JitoBlockEngineAdapter::default().id(),
            PythHermesAdapter::default().id(),
            SwitchboardOnDemandAdapter::default().id(),
            PollingBirdeyeAdapter::default().id(),
            PollingDefiLlamaAdapter::default().id(),
            PollingJupiterAdapter::default().id(),
            MeteoraAdapter::default().id(),
            OrcaAdapter::default().id(),
            RaydiumAdapter::default().id(),
        ];
        let mut ids = adapters.clone();
        ids.sort_by_key(|s| *s as u8);
        ids.dedup();
        assert_eq!(ids.len(), adapters.len());
    }

    #[tokio::test]
    async fn health_starts_green_and_set_health_works() {
        let a = PythHermesAdapter::default();
        assert!(a.health().healthy);
        a.set_health(Health::down());
        assert!(!a.health().healthy);
    }
}

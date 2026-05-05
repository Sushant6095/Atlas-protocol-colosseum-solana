//! In-process typed event bus with bounded channels and content-addressed dedup.
//!
//! Two channels: `commitment` (commitment-bound events whose loss invalidates
//! a downstream proof) and `monitoring` (everything else). Overflow on the
//! commitment channel is fatal; overflow on monitoring increments a counter.
//!
//! Dedup is content-addressed: `event_id = blake3(canonical_bytes)`. The seen
//! set is bounded; eviction is FIFO once capacity is reached. The window is
//! large enough to absorb realistic out-of-order tolerance (32 events) plus
//! cross-source duplicates.

use crate::event::{event_id, AtlasEvent};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

#[derive(Clone, Copy, Debug)]
pub struct BusConfig {
    pub commitment_capacity: usize,
    pub monitoring_capacity: usize,
    pub dedup_window: usize,
    /// Maximum out-of-order events tolerated on the commitment channel.
    pub max_reorder_window: u32,
}

impl Default for BusConfig {
    fn default() -> Self {
        Self {
            commitment_capacity: 65_536,
            monitoring_capacity: 65_536,
            dedup_window: 131_072,
            max_reorder_window: 32,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BusError {
    #[error("commitment channel overflow — fatal")]
    CommitmentOverflow,
    #[error("monitoring channel overflow")]
    MonitoringOverflow,
    #[error("event dedup'd: id={0:?}")]
    Dedup([u8; 32]),
    #[error("reorder window exceeded: dropped event at slot {0}, latest slot {1}")]
    ReorderViolation(u64, u64),
}

/// Bounded ring used for FIFO dedup eviction. Fast at the cost of being a
/// near-LRU rather than a strict LRU; collisions only matter if the window is
/// undersized, which is detected by `dedup_dropped_total` rate alerts.
struct DedupRing {
    cap: usize,
    queue: VecDeque<[u8; 32]>,
    /// Sorted vec used to keep `contains` cheap without pulling in a hash dep.
    /// We accept O(log n) lookups + O(n) inserts because the ring is bounded.
    sorted: Vec<[u8; 32]>,
}

impl DedupRing {
    fn new(cap: usize) -> Self {
        Self {
            cap,
            queue: VecDeque::with_capacity(cap.min(16_384)),
            sorted: Vec::with_capacity(cap.min(16_384)),
        }
    }

    fn contains(&self, id: &[u8; 32]) -> bool {
        self.sorted.binary_search(id).is_ok()
    }

    /// Returns true if the id was newly inserted (not a duplicate).
    fn insert(&mut self, id: [u8; 32]) -> bool {
        if self.contains(&id) {
            return false;
        }
        if self.queue.len() >= self.cap {
            if let Some(evicted) = self.queue.pop_front() {
                if let Ok(idx) = self.sorted.binary_search(&evicted) {
                    self.sorted.remove(idx);
                }
            }
        }
        match self.sorted.binary_search(&id) {
            Ok(_) => false,
            Err(idx) => {
                self.sorted.insert(idx, id);
                self.queue.push_back(id);
                true
            }
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct BusCounters {
    inner: Arc<std::sync::atomic::AtomicU64>,
    overflow_monitoring: Arc<std::sync::atomic::AtomicU64>,
    dedup_dropped: Arc<std::sync::atomic::AtomicU64>,
    reorder_dropped: Arc<std::sync::atomic::AtomicU64>,
}

impl BusCounters {
    pub fn published(&self) -> u64 {
        self.inner.load(std::sync::atomic::Ordering::Relaxed)
    }
    pub fn monitoring_overflow(&self) -> u64 {
        self.overflow_monitoring.load(std::sync::atomic::Ordering::Relaxed)
    }
    pub fn dedup_dropped(&self) -> u64 {
        self.dedup_dropped.load(std::sync::atomic::Ordering::Relaxed)
    }
    pub fn reorder_dropped(&self) -> u64 {
        self.reorder_dropped.load(std::sync::atomic::Ordering::Relaxed)
    }
}

pub struct AtlasBus {
    config: BusConfig,
    commitment_tx: mpsc::Sender<AtlasEvent>,
    monitoring_tx: mpsc::Sender<AtlasEvent>,
    counters: BusCounters,
    seen: Arc<Mutex<DedupRing>>,
    reorder_state: Arc<Mutex<ReorderState>>,
}

#[derive(Default)]
struct ReorderState {
    /// Latest slot accepted on the commitment channel.
    latest_commitment_slot: u64,
}

pub struct BusReceiver {
    pub commitment: mpsc::Receiver<AtlasEvent>,
    pub monitoring: mpsc::Receiver<AtlasEvent>,
}

impl AtlasBus {
    pub fn new(config: BusConfig) -> (Self, BusReceiver) {
        let (commitment_tx, commitment_rx) = mpsc::channel(config.commitment_capacity);
        let (monitoring_tx, monitoring_rx) = mpsc::channel(config.monitoring_capacity);
        let bus = Self {
            config,
            commitment_tx,
            monitoring_tx,
            counters: BusCounters::default(),
            seen: Arc::new(Mutex::new(DedupRing::new(config.dedup_window))),
            reorder_state: Arc::new(Mutex::new(ReorderState::default())),
        };
        let rx = BusReceiver {
            commitment: commitment_rx,
            monitoring: monitoring_rx,
        };
        (bus, rx)
    }

    pub fn config(&self) -> BusConfig {
        self.config
    }

    pub fn counters(&self) -> BusCounters {
        self.counters.clone()
    }

    /// Inject an event onto the bus. Routes to commitment or monitoring channel
    /// based on `is_commitment_bound`. Performs dedup and reorder checks.
    pub async fn inject(&self, event: AtlasEvent) -> Result<(), BusError> {
        let id = event_id(&event);
        let mut seen = self.seen.lock().await;
        if !seen.insert(id) {
            self.counters.dedup_dropped.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            return Err(BusError::Dedup(id));
        }
        drop(seen);

        if event.is_commitment_bound() {
            // Reorder check: events older than max_reorder_window slots behind
            // the latest accepted commitment-bound event are rejected.
            let mut state = self.reorder_state.lock().await;
            let slot = event.slot();
            if state.latest_commitment_slot > 0
                && slot + (self.config.max_reorder_window as u64) < state.latest_commitment_slot
            {
                self.counters.reorder_dropped.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                return Err(BusError::ReorderViolation(slot, state.latest_commitment_slot));
            }
            if slot > state.latest_commitment_slot {
                state.latest_commitment_slot = slot;
            }
            drop(state);

            self.commitment_tx
                .try_send(event)
                .map_err(|_| BusError::CommitmentOverflow)?;
        } else {
            if let Err(_) = self.monitoring_tx.try_send(event) {
                self.counters
                    .overflow_monitoring
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                return Err(BusError::MonitoringOverflow);
            }
        }
        self.counters.inner.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::{AtlasEvent, BundleStatus, SourceId};
    use bytes::Bytes;

    fn account_update(seq: u64, slot: u64) -> AtlasEvent {
        AtlasEvent::AccountUpdate {
            pubkey: [1u8; 32],
            slot,
            data_hash: [9u8; 32],
            data: Bytes::from_static(&[1, 2, 3]),
            source: SourceId::YellowstoneTriton,
            seq,
        }
    }

    #[tokio::test]
    async fn deduplicates_same_event_id() {
        let (bus, mut rx) = AtlasBus::new(BusConfig::default());
        let e = account_update(1, 100);
        bus.inject(e.clone()).await.unwrap();
        let result = bus.inject(e).await;
        assert!(matches!(result, Err(BusError::Dedup(_))));
        // First event landed on commitment channel.
        let _ = rx.commitment.recv().await.unwrap();
        assert_eq!(bus.counters().dedup_dropped(), 1);
    }

    #[tokio::test]
    async fn routes_commitment_vs_monitoring() {
        let (bus, mut rx) = AtlasBus::new(BusConfig::default());
        bus.inject(account_update(1, 100)).await.unwrap();
        bus.inject(AtlasEvent::SlotAdvance {
            slot: 200,
            leader: [0u8; 32],
            parent: 199,
        })
        .await
        .unwrap();
        bus.inject(AtlasEvent::BundleStatusEvent {
            bundle_id: [9u8; 32],
            status: BundleStatus::Landed,
            landed_slot: Some(200),
        })
        .await
        .unwrap();

        // 1 commitment, 2 monitoring
        let _ = rx.commitment.try_recv().unwrap();
        assert!(rx.commitment.try_recv().is_err());
        let _ = rx.monitoring.try_recv().unwrap();
        let _ = rx.monitoring.try_recv().unwrap();
    }

    #[tokio::test]
    async fn commitment_overflow_is_fatal() {
        let (bus, _rx) = AtlasBus::new(BusConfig {
            commitment_capacity: 2,
            monitoring_capacity: 8,
            dedup_window: 1024,
            max_reorder_window: 32,
        });
        bus.inject(account_update(1, 100)).await.unwrap();
        bus.inject(account_update(2, 101)).await.unwrap();
        // The receiver isn't draining, so the next commitment event must overflow.
        let r = bus.inject(account_update(3, 102)).await;
        assert!(matches!(r, Err(BusError::CommitmentOverflow)));
    }

    #[tokio::test]
    async fn monitoring_overflow_increments_counter() {
        let (bus, _rx) = AtlasBus::new(BusConfig {
            commitment_capacity: 32,
            monitoring_capacity: 1,
            dedup_window: 1024,
            max_reorder_window: 32,
        });
        bus.inject(AtlasEvent::SlotAdvance { slot: 1, leader: [0; 32], parent: 0 }).await.unwrap();
        let r = bus.inject(AtlasEvent::SlotAdvance { slot: 2, leader: [0; 32], parent: 1 }).await;
        assert!(matches!(r, Err(BusError::MonitoringOverflow)));
        assert_eq!(bus.counters().monitoring_overflow(), 1);
    }

    #[tokio::test]
    async fn reorder_violation_rejects_too_old() {
        let (bus, _rx) = AtlasBus::new(BusConfig {
            commitment_capacity: 32,
            monitoring_capacity: 32,
            dedup_window: 1024,
            max_reorder_window: 4,
        });
        bus.inject(account_update(1, 1_000)).await.unwrap();
        // 1_000 - max_reorder_window=4 → boundary 996; anything < 996 must reject.
        let r = bus.inject(account_update(2, 990)).await;
        assert!(matches!(r, Err(BusError::ReorderViolation(_, _))));
    }
}

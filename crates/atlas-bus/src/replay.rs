//! Replay-mode bus.
//!
//! `ReplayBus` is a synchronous, single-threaded, deterministic re-feeder of
//! a recorded event sequence. Downstream consumers cannot distinguish replay
//! from live except via the `replay=true` span tag (set by the orchestrator,
//! not the bus). All adapters are stubbed; events are read from the warehouse's
//! append-only log (Phase 03 owns the log; this crate owns the in-memory shape).

use crate::event::AtlasEvent;
use std::collections::VecDeque;

/// In-memory replay source — the warehouse layer (Phase 03) plugs a streaming
/// version of this for archived slot ranges.
pub struct ReplaySource {
    queue: VecDeque<AtlasEvent>,
}

impl ReplaySource {
    pub fn from_events(events: Vec<AtlasEvent>) -> Self {
        Self { queue: events.into() }
    }

    pub fn push(&mut self, event: AtlasEvent) {
        self.queue.push_back(event);
    }

    pub fn next(&mut self) -> Option<AtlasEvent> {
        self.queue.pop_front()
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

/// Replay bus — drains a `ReplaySource` into a consumer closure deterministically.
/// No async, no tasks, no shared mutable state between events. The same input
/// must produce the same output across machines and runs.
pub struct ReplayBus {
    source: ReplaySource,
}

impl ReplayBus {
    pub fn new(source: ReplaySource) -> Self {
        Self { source }
    }

    pub fn drain<F>(mut self, mut on_event: F) -> u64
    where
        F: FnMut(AtlasEvent),
    {
        let mut count = 0u64;
        while let Some(e) = self.source.next() {
            on_event(e);
            count += 1;
        }
        count
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

    #[test]
    fn drains_all_events_in_order() {
        let events = vec![
            account_update(1, 100),
            account_update(2, 101),
            account_update(3, 102),
        ];
        let bus = ReplayBus::new(ReplaySource::from_events(events.clone()));
        let mut seen: Vec<u64> = Vec::new();
        let count = bus.drain(|e| {
            if let AtlasEvent::AccountUpdate { seq, .. } = e {
                seen.push(seq);
            }
        });
        assert_eq!(count, 3);
        assert_eq!(seen, vec![1, 2, 3]);
    }

    #[test]
    fn replay_parity_two_runs_identical() {
        let events = vec![
            account_update(1, 100),
            AtlasEvent::SlotAdvance { slot: 101, leader: [0; 32], parent: 100 },
            account_update(2, 102),
            AtlasEvent::BundleStatusEvent {
                bundle_id: [7u8; 32],
                status: BundleStatus::Landed,
                landed_slot: Some(102),
            },
        ];
        let mut a = Vec::new();
        ReplayBus::new(ReplaySource::from_events(events.clone())).drain(|e| a.push(e));
        let mut b = Vec::new();
        ReplayBus::new(ReplaySource::from_events(events.clone())).drain(|e| b.push(e));
        assert_eq!(a, b);
    }
}

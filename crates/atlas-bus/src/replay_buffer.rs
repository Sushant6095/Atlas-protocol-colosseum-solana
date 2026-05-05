//! Per-source replay buffer (directive §4).
//!
//! Each adapter maintains a 256-slot ring of recently emitted events keyed by
//! `(source_seq, slot)`. On reconnect, the adapter rewinds to
//! `last_acked_slot + 1` and resumes; downstream dedup absorbs the overlap.

use crate::event::AtlasEvent;
use std::collections::VecDeque;

#[derive(Clone, Debug)]
pub struct ReplayEntry {
    pub seq: u64,
    pub slot: u64,
    pub event: AtlasEvent,
}

pub struct SourceReplayBuffer {
    /// Capacity in distinct slots (default 256).
    slot_capacity: u64,
    /// `last_acked_slot` increases monotonically as the consumer acknowledges
    /// receipt of every event up to `slot`. Adapter rewinds to this on reconnect.
    last_acked_slot: u64,
    queue: VecDeque<ReplayEntry>,
}

impl SourceReplayBuffer {
    pub fn new(slot_capacity: u64) -> Self {
        Self {
            slot_capacity,
            last_acked_slot: 0,
            queue: VecDeque::new(),
        }
    }

    pub fn push(&mut self, entry: ReplayEntry) {
        let slot = entry.slot;
        self.queue.push_back(entry);
        // Evict events older than (slot - slot_capacity).
        let cutoff = slot.saturating_sub(self.slot_capacity);
        while let Some(front) = self.queue.front() {
            if front.slot < cutoff {
                self.queue.pop_front();
            } else {
                break;
            }
        }
    }

    pub fn ack(&mut self, slot: u64) {
        if slot > self.last_acked_slot {
            self.last_acked_slot = slot;
        }
    }

    pub fn last_acked_slot(&self) -> u64 {
        self.last_acked_slot
    }

    /// Rewind: produces all entries with `slot > last_acked_slot`. Used when
    /// the upstream connection re-establishes.
    pub fn rewind(&self) -> Vec<&ReplayEntry> {
        self.queue
            .iter()
            .filter(|e| e.slot > self.last_acked_slot)
            .collect()
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    pub fn slot_capacity(&self) -> u64 {
        self.slot_capacity
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::SourceId;
    use bytes::Bytes;

    fn entry(seq: u64, slot: u64) -> ReplayEntry {
        ReplayEntry {
            seq,
            slot,
            event: AtlasEvent::AccountUpdate {
                pubkey: [1u8; 32],
                slot,
                data_hash: [seq as u8; 32],
                data: Bytes::from_static(&[]),
                source: SourceId::YellowstoneTriton,
                seq,
            },
        }
    }

    #[test]
    fn evicts_events_older_than_capacity() {
        let mut buf = SourceReplayBuffer::new(10);
        for slot in 0..30u64 {
            buf.push(entry(slot, slot));
        }
        // Latest slot 29; cutoff 29-10=19. Anything < 19 evicted.
        assert!(buf.queue.iter().all(|e| e.slot >= 19));
    }

    #[test]
    fn rewind_returns_only_post_ack_events() {
        let mut buf = SourceReplayBuffer::new(256);
        for slot in 100..150u64 {
            buf.push(entry(slot, slot));
        }
        buf.ack(120);
        let rewind: Vec<u64> = buf.rewind().iter().map(|e| e.slot).collect();
        assert!(rewind.iter().all(|&s| s > 120));
        assert!(rewind.contains(&149));
    }

    #[test]
    fn ack_is_monotonic() {
        let mut buf = SourceReplayBuffer::new(256);
        buf.ack(100);
        buf.ack(80);
        assert_eq!(buf.last_acked_slot(), 100);
        buf.ack(200);
        assert_eq!(buf.last_acked_slot(), 200);
    }
}

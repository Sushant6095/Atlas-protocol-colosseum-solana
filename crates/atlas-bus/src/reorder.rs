//! 32-deep out-of-order reorder buffer for the commitment channel (§4).
//!
//! Events arriving with a `seq` lower than the current high watermark are
//! buffered. Once the next-expected `seq` arrives, drained events are
//! released in order. Events that fall outside the buffer window emit
//! `ReorderError` — caller halts and reconciles via replay.

use crate::event::AtlasEvent;
use std::cmp::Reverse;
use std::collections::BinaryHeap;

#[derive(Clone, Copy, Debug)]
pub struct ReorderConfig {
    pub max_window: u32,
}

impl Default for ReorderConfig {
    fn default() -> Self {
        Self { max_window: 32 }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ReorderError {
    #[error("event seq {got} fell {gap} positions behind watermark {watermark} (max window {window})")]
    OutOfWindow { got: u64, gap: u64, watermark: u64, window: u32 },
}

#[derive(Clone, Debug)]
struct HeapEntry {
    seq: u64,
    event: AtlasEvent,
}

impl PartialEq for HeapEntry {
    fn eq(&self, other: &Self) -> bool {
        self.seq == other.seq
    }
}
impl Eq for HeapEntry {}
impl PartialOrd for HeapEntry {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.seq.cmp(&other.seq))
    }
}
impl Ord for HeapEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.seq.cmp(&other.seq)
    }
}

pub struct ReorderBuffer {
    config: ReorderConfig,
    /// Min-heap by seq.
    heap: BinaryHeap<Reverse<HeapEntry>>,
    /// `next_expected_seq` — the seq we will release next when it arrives.
    next_expected: u64,
    /// Highest seq seen so far. Used to detect out-of-window events.
    high_watermark: u64,
}

impl ReorderBuffer {
    pub fn new(config: ReorderConfig, initial_next_expected: u64) -> Self {
        Self {
            config,
            heap: BinaryHeap::new(),
            next_expected: initial_next_expected,
            high_watermark: initial_next_expected,
        }
    }

    pub fn next_expected(&self) -> u64 {
        self.next_expected
    }

    pub fn buffered(&self) -> usize {
        self.heap.len()
    }

    /// Insert an event. If it is the next-expected, returns it (plus any
    /// subsequently unblocked events). If it is out of window, returns
    /// `Err(OutOfWindow)`.
    pub fn insert(&mut self, seq: u64, event: AtlasEvent) -> Result<Vec<AtlasEvent>, ReorderError> {
        // Out-of-window check: the seq is before our current next_expected by
        // more than `max_window` positions.
        if seq + self.config.max_window as u64 <= self.next_expected {
            return Err(ReorderError::OutOfWindow {
                got: seq,
                gap: self.next_expected.saturating_sub(seq),
                watermark: self.high_watermark,
                window: self.config.max_window,
            });
        }

        if seq < self.next_expected {
            // Already passed in order — duplicate per dedup contract; drop.
            return Ok(vec![]);
        }

        if seq > self.high_watermark {
            self.high_watermark = seq;
        }

        if seq == self.next_expected {
            let mut released = vec![event];
            self.next_expected = self.next_expected.saturating_add(1);
            // Drain any contiguous buffered seqs.
            while let Some(top) = self.heap.peek() {
                if top.0.seq == self.next_expected {
                    let popped = self.heap.pop();
                    if let Some(Reverse(entry)) = popped {
                        released.push(entry.event);
                        self.next_expected = self.next_expected.saturating_add(1);
                    }
                } else {
                    break;
                }
            }
            return Ok(released);
        }

        // Hold for later.
        if self.heap.len() >= self.config.max_window as usize {
            return Err(ReorderError::OutOfWindow {
                got: seq,
                gap: 0,
                watermark: self.high_watermark,
                window: self.config.max_window,
            });
        }
        self.heap.push(Reverse(HeapEntry { seq, event }));
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::SourceId;
    use bytes::Bytes;

    fn ev(seq: u64) -> AtlasEvent {
        AtlasEvent::AccountUpdate {
            pubkey: [1u8; 32],
            slot: seq,
            data_hash: [seq as u8; 32],
            data: Bytes::from_static(&[]),
            source: SourceId::YellowstoneTriton,
            seq,
        }
    }

    #[test]
    fn releases_in_order() {
        let mut buf = ReorderBuffer::new(ReorderConfig::default(), 0);
        let r = buf.insert(0, ev(0)).unwrap();
        assert_eq!(r.len(), 1);
        let r = buf.insert(1, ev(1)).unwrap();
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn buffers_then_releases_when_gap_fills() {
        let mut buf = ReorderBuffer::new(ReorderConfig::default(), 0);
        // Skip 0, push 1..=3 first.
        for s in 1u64..=3 {
            let r = buf.insert(s, ev(s)).unwrap();
            assert!(r.is_empty(), "should buffer until 0 arrives");
        }
        // Now 0 arrives — should release 0,1,2,3 contiguously.
        let r = buf.insert(0, ev(0)).unwrap();
        assert_eq!(r.len(), 4);
    }

    #[test]
    fn rejects_out_of_window() {
        let mut buf = ReorderBuffer::new(ReorderConfig { max_window: 4 }, 100);
        // 100 - 4 = 96 → seq <= 95 must reject.
        let r = buf.insert(95, ev(95));
        assert!(matches!(r, Err(ReorderError::OutOfWindow { .. })));
    }

    #[test]
    fn duplicate_already_passed_returns_empty() {
        let mut buf = ReorderBuffer::new(ReorderConfig::default(), 10);
        // seq 5 — already-passed but within window (default 32) → just drop, no error.
        let r = buf.insert(5, ev(5)).unwrap();
        assert!(r.is_empty());
    }

    #[test]
    fn buffer_full_rejects() {
        let mut buf = ReorderBuffer::new(ReorderConfig { max_window: 4 }, 0);
        // Skip 0, fill buffer with 1..=4 (4 entries = max_window).
        for s in 1u64..=4 {
            buf.insert(s, ev(s)).unwrap();
        }
        // Add a 5th held event — must reject.
        let r = buf.insert(5, ev(5));
        assert!(matches!(r, Err(ReorderError::OutOfWindow { .. })));
    }
}

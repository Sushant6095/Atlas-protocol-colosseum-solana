//! Long-running Bubblegum flusher process (directive §3).
//!
//! `BubblegumFlusher` runs as a separate tokio task. It batches receipts
//! every `flush_every_n_slots` slot ticks **or** every `flush_every_n_leaves`
//! leaves (whichever first), computes the Merkle root, and emits an
//! `BubblegumAnchorReceipt` on a tokio channel ready for the on-chain CPI
//! keeper to commit.
//!
//! Telemetry: `atlas_warehouse_bubblegum_anchor_lag_slots` is observed on
//! every flush.

use crate::bubblegum::{BubblegumAnchorKeeper, BubblegumAnchorReceipt};
use atlas_telemetry::WAREHOUSE_BUBBLEGUM_ANCHOR_LAG_SLOTS;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};

#[derive(Clone, Copy, Debug)]
pub struct FlusherConfig {
    pub flush_every_n_leaves: u32,
    pub flush_every_n_slots: u64,
    /// Hard ceiling on pending leaves; safety valve if no flush condition fires.
    pub max_pending_leaves: u32,
}

impl Default for FlusherConfig {
    fn default() -> Self {
        Self {
            flush_every_n_leaves: 256,
            flush_every_n_slots: 600,
            max_pending_leaves: 4096,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PendingReceipt {
    pub slot: u64,
    pub vault_id: [u8; 32],
    pub canonical_bytes: Vec<u8>,
}

/// Producer handle — pipeline writers call `enqueue` to feed receipts.
#[derive(Clone)]
pub struct FlusherHandle {
    tx: mpsc::Sender<PendingReceipt>,
}

impl FlusherHandle {
    pub async fn enqueue(&self, receipt: PendingReceipt) -> Result<(), &'static str> {
        self.tx.send(receipt).await.map_err(|_| "flusher channel closed")
    }
}

pub struct BubblegumFlusher {
    config: FlusherConfig,
    keeper: Arc<Mutex<BubblegumAnchorKeeper>>,
    rx: mpsc::Receiver<PendingReceipt>,
    anchor_tx: mpsc::Sender<BubblegumAnchorReceipt>,
    /// `Some(slot)` once at least one receipt has been processed. The slot
    /// threshold is measured from this anchor, not from zero (otherwise the
    /// first incoming receipt would always exceed the threshold against the
    /// default `0` and force an immediate flush).
    last_flush_slot: Option<u64>,
    highest_slot_seen: u64,
}

impl BubblegumFlusher {
    pub fn new(
        config: FlusherConfig,
        receipt_buffer: usize,
        anchor_buffer: usize,
    ) -> (Self, FlusherHandle, mpsc::Receiver<BubblegumAnchorReceipt>) {
        let (tx, rx) = mpsc::channel(receipt_buffer);
        let (anchor_tx, anchor_rx) = mpsc::channel(anchor_buffer);
        let keeper = Arc::new(Mutex::new(BubblegumAnchorKeeper::new(
            config.flush_every_n_leaves,
        )));
        let flusher = Self {
            config,
            keeper,
            rx,
            anchor_tx,
            last_flush_slot: None,
            highest_slot_seen: 0,
        };
        (flusher, FlusherHandle { tx }, anchor_rx)
    }

    /// Drive the flusher loop until the receipt channel closes. Designed to
    /// run inside `tokio::spawn`.
    pub async fn run(mut self) {
        while let Some(receipt) = self.rx.recv().await {
            self.process(receipt).await;
        }
        // Channel closed — emit a final flush of pending leaves.
        let pending_at_close = self.keeper.lock().await.pending_len();
        if pending_at_close > 0 {
            self.do_flush().await;
        }
    }

    async fn process(&mut self, r: PendingReceipt) {
        if r.slot > self.highest_slot_seen {
            self.highest_slot_seen = r.slot;
        }
        let mut keeper = self.keeper.lock().await;
        let immediate = keeper.record(r.slot, &r.canonical_bytes);
        let pending = keeper.pending_len();
        drop(keeper);

        if let Some(receipt) = immediate {
            self.publish_anchor(receipt).await;
            return;
        }

        // Anchor the slot threshold to the first receipt we ever saw so the
        // very first event does not unconditionally force a flush.
        let anchor = *self.last_flush_slot.get_or_insert(r.slot);
        let slots_since_flush = self.highest_slot_seen.saturating_sub(anchor);
        if slots_since_flush >= self.config.flush_every_n_slots
            || pending as u32 >= self.config.max_pending_leaves
        {
            self.do_flush().await;
        }
    }

    async fn do_flush(&mut self) {
        let receipt = {
            let mut keeper = self.keeper.lock().await;
            if keeper.pending_len() == 0 {
                return;
            }
            keeper.flush()
        };
        self.publish_anchor(receipt).await;
    }

    async fn publish_anchor(&mut self, receipt: BubblegumAnchorReceipt) {
        let lag_slots = self.highest_slot_seen.saturating_sub(receipt.slot_high);
        WAREHOUSE_BUBBLEGUM_ANCHOR_LAG_SLOTS
            .with_label_values(&["_global", "false"])
            .observe(lag_slots as f64);
        self.last_flush_slot = Some(receipt.slot_high);
        // Drop the receipt if the consumer closed — anchoring keeper retains
        // history regardless. Real consumer (on-chain CPI keeper) is durable;
        // dropping here is non-fatal.
        let _ = self.anchor_tx.send(receipt).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn pending(slot: u64, n: u8) -> PendingReceipt {
        PendingReceipt {
            slot,
            vault_id: [1u8; 32],
            canonical_bytes: vec![n; 16],
        }
    }

    #[tokio::test]
    async fn flushes_at_leaf_threshold() {
        let cfg = FlusherConfig {
            flush_every_n_leaves: 3,
            flush_every_n_slots: 1_000_000,
            max_pending_leaves: 4096,
        };
        let (flusher, handle, mut anchor_rx) = BubblegumFlusher::new(cfg, 32, 32);
        let task = tokio::spawn(flusher.run());
        for i in 0..3u8 {
            handle.enqueue(pending(100 + i as u64, i)).await.unwrap();
        }
        let r = tokio::time::timeout(Duration::from_secs(1), anchor_rx.recv()).await.unwrap().unwrap();
        assert_eq!(r.leaf_count, 3);
        drop(handle);
        let _ = task.await;
    }

    #[tokio::test]
    async fn flushes_at_slot_threshold_even_with_partial_batch() {
        let cfg = FlusherConfig {
            flush_every_n_leaves: 1_000,
            flush_every_n_slots: 5,
            max_pending_leaves: 4096,
        };
        let (flusher, handle, mut anchor_rx) = BubblegumFlusher::new(cfg, 32, 32);
        let task = tokio::spawn(flusher.run());
        // Push a single leaf at slot 100, then a leaf at slot 110 (10 slots
        // later) — slot threshold (5) crosses on the second push.
        handle.enqueue(pending(100, 1)).await.unwrap();
        handle.enqueue(pending(110, 2)).await.unwrap();
        let r = tokio::time::timeout(Duration::from_secs(1), anchor_rx.recv()).await.unwrap().unwrap();
        assert_eq!(r.leaf_count, 2);
        drop(handle);
        let _ = task.await;
    }

    #[tokio::test]
    async fn final_flush_on_channel_close() {
        let cfg = FlusherConfig {
            flush_every_n_leaves: 1_000,
            flush_every_n_slots: 1_000_000,
            max_pending_leaves: 4096,
        };
        let (flusher, handle, mut anchor_rx) = BubblegumFlusher::new(cfg, 32, 32);
        let task = tokio::spawn(flusher.run());
        handle.enqueue(pending(1, 1)).await.unwrap();
        handle.enqueue(pending(2, 2)).await.unwrap();
        drop(handle);
        let r = tokio::time::timeout(Duration::from_secs(1), anchor_rx.recv()).await.unwrap().unwrap();
        assert_eq!(r.leaf_count, 2);
        let _ = task.await;
    }
}

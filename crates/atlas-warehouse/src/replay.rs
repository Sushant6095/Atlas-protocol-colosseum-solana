//! Replay API — `atlas-warehouse replay` consumed by Phase 02 `atlas-bus replay`.
//!
//! Returns the canonical event byte sequence over a slot range. Phase 2 pipes
//! this into the bus's `ReplayBus::drain` so the same code that runs live also
//! runs against the warehouse, with `replay=true` span tag.

use crate::client::{WarehouseClient, WarehouseError};
use crate::schema::EventRow;

#[derive(Clone, Copy, Debug)]
pub struct ReplayQuery {
    pub slot_lo: u64,
    pub slot_hi: u64,
    pub vault_id: Option<[u8; 32]>,
}

#[derive(Clone, Debug)]
pub struct ReplayResponse {
    pub events: Vec<EventRow>,
    pub event_count: usize,
    pub slot_lo: u64,
    pub slot_hi: u64,
}

pub async fn replay(
    backend: &dyn WarehouseClient,
    q: ReplayQuery,
) -> Result<ReplayResponse, WarehouseError> {
    let events = backend.read_events_range(q.slot_lo, q.slot_hi).await?;
    Ok(ReplayResponse {
        event_count: events.len(),
        events,
        slot_lo: q.slot_lo,
        slot_hi: q.slot_hi,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mock::MockWarehouse;
    use crate::schema::EventRow;

    #[tokio::test]
    async fn replay_returns_events_in_range_sorted_by_slot() {
        let w = MockWarehouse::new();
        for s in (0..50u64).rev() {
            let mut id = [0u8; 32];
            id[..8].copy_from_slice(&s.to_le_bytes());
            let row = EventRow {
                slot: s,
                source: 1,
                epoch: 0,
                event_id: id,
                canonical_bytes: vec![s as u8; 4],
            };
            w.insert_event(&row).await.unwrap();
        }
        let resp = replay(&w, ReplayQuery { slot_lo: 10, slot_hi: 20, vault_id: None })
            .await
            .unwrap();
        assert_eq!(resp.event_count, 11);
        for w_pair in resp.events.windows(2) {
            assert!(w_pair[0].slot <= w_pair[1].slot);
        }
    }
}

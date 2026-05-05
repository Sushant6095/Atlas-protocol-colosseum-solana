//! Event types, source ids, canonical encoding, content-addressed event id.
//!
//! Canonical encoding is deterministic across machines, OS versions, rebuilds.
//! The `event_id` is `blake3(canonical_bytes)` and is the primary dedup key.

use bytes::Bytes;
use serde::{Deserialize, Serialize};

pub type Pubkey = [u8; 32];
pub type Signature = [u8; 64];
pub type FeedId = u32;

/// Stable u8 discriminants — wire format is part of the dedup key.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum SourceId {
    YellowstoneTriton = 0x01,
    YellowstoneHelius = 0x02,
    YellowstoneQuickNode = 0x03,
    HeliusWebSocket = 0x04,
    HeliusWebhook = 0x05,
    JitoBlockEngine = 0x06,
    PythHermes = 0x07,
    SwitchboardOnDemand = 0x08,
    Birdeye = 0x09,
    DefiLlama = 0x0A,
    Jupiter = 0x0B,
    Meteora = 0x0C,
    Orca = 0x0D,
    Raydium = 0x0E,
}

impl SourceId {
    pub fn name(self) -> &'static str {
        match self {
            SourceId::YellowstoneTriton => "yellowstone_triton",
            SourceId::YellowstoneHelius => "yellowstone_helius",
            SourceId::YellowstoneQuickNode => "yellowstone_quicknode",
            SourceId::HeliusWebSocket => "helius_ws",
            SourceId::HeliusWebhook => "helius_webhook",
            SourceId::JitoBlockEngine => "jito_block_engine",
            SourceId::PythHermes => "pyth_hermes",
            SourceId::SwitchboardOnDemand => "switchboard_on_demand",
            SourceId::Birdeye => "birdeye",
            SourceId::DefiLlama => "defillama",
            SourceId::Jupiter => "jupiter",
            SourceId::Meteora => "meteora",
            SourceId::Orca => "orca",
            SourceId::Raydium => "raydium",
        }
    }

    pub fn is_geyser(self) -> bool {
        matches!(
            self,
            SourceId::YellowstoneTriton
                | SourceId::YellowstoneHelius
                | SourceId::YellowstoneQuickNode
        )
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum OracleSource {
    PythHermes = 0,
    SwitchboardOnDemand = 1,
    DexTwap = 2,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum TxStatus {
    Success = 0,
    Failed = 1,
    Skipped = 2,
    Dropped = 3,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum BundleStatus {
    Submitted = 0,
    Landed = 1,
    Failed = 2,
    Dropped = 3,
}

/// Atlas's single typed event surface. Every adapter normalizes its native
/// payload into one of these variants. New variants require a discriminant
/// + canonical-byte tag bump.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AtlasEvent {
    AccountUpdate {
        pubkey: Pubkey,
        slot: u64,
        data_hash: [u8; 32],
        data: Bytes,
        source: SourceId,
        seq: u64,
    },
    TransactionLanded {
        sig: Signature,
        slot: u64,
        status: TxStatus,
        source: SourceId,
        seq: u64,
    },
    OracleTick {
        feed_id: FeedId,
        price_q64: i64,
        conf_q64: u64,
        publish_slot: u64,
        source: OracleSource,
        seq: u64,
    },
    PoolStateChange {
        pool: Pubkey,
        slot: u64,
        snapshot_hash: [u8; 32],
        source: SourceId,
        seq: u64,
    },
    SlotAdvance {
        slot: u64,
        leader: Pubkey,
        parent: u64,
    },
    BundleStatusEvent {
        bundle_id: [u8; 32],
        status: BundleStatus,
        landed_slot: Option<u64>,
    },
    HealthSignal {
        source: SourceId,
        lag_slots: u64,
        error_rate_bps: u32,
    },
}

impl AtlasEvent {
    /// True when the event must reach the commitment channel — its loss
    /// invalidates a downstream proof. Maps to "commitment-bound" classification.
    pub fn is_commitment_bound(&self) -> bool {
        matches!(
            self,
            AtlasEvent::AccountUpdate { .. }
                | AtlasEvent::OracleTick { .. }
                | AtlasEvent::PoolStateChange { .. }
        )
    }

    /// On-chain slot anchor used for replay ordering and freshness gates.
    pub fn slot(&self) -> u64 {
        match self {
            AtlasEvent::AccountUpdate { slot, .. } => *slot,
            AtlasEvent::TransactionLanded { slot, .. } => *slot,
            AtlasEvent::OracleTick { publish_slot, .. } => *publish_slot,
            AtlasEvent::PoolStateChange { slot, .. } => *slot,
            AtlasEvent::SlotAdvance { slot, .. } => *slot,
            AtlasEvent::BundleStatusEvent { landed_slot, .. } => landed_slot.unwrap_or(0),
            AtlasEvent::HealthSignal { lag_slots, .. } => *lag_slots,
        }
    }

    /// Variant tag used in canonical encoding.
    pub fn tag(&self) -> u8 {
        match self {
            AtlasEvent::AccountUpdate { .. } => 0x01,
            AtlasEvent::TransactionLanded { .. } => 0x02,
            AtlasEvent::OracleTick { .. } => 0x03,
            AtlasEvent::PoolStateChange { .. } => 0x04,
            AtlasEvent::SlotAdvance { .. } => 0x05,
            AtlasEvent::BundleStatusEvent { .. } => 0x06,
            AtlasEvent::HealthSignal { .. } => 0x07,
        }
    }
}

/// Canonical byte encoding — used to compute `event_id`. Stable across
/// machines, OS versions, and Rust toolchain upgrades. Adding a field to
/// any variant requires bumping the variant's tag byte.
pub fn canonical_event_bytes(e: &AtlasEvent) -> Vec<u8> {
    let mut out = Vec::with_capacity(128);
    out.push(e.tag());
    match e {
        AtlasEvent::AccountUpdate { pubkey, slot, data_hash, data, source, seq } => {
            out.extend_from_slice(pubkey);
            out.extend_from_slice(&slot.to_le_bytes());
            out.extend_from_slice(data_hash);
            // Hash the data ourselves so we don't bloat the event_id input.
            let dh = blake3::hash(data);
            out.extend_from_slice(dh.as_bytes());
            out.push(*source as u8);
            out.extend_from_slice(&seq.to_le_bytes());
        }
        AtlasEvent::TransactionLanded { sig, slot, status, source, seq } => {
            out.extend_from_slice(sig);
            out.extend_from_slice(&slot.to_le_bytes());
            out.push(*status as u8);
            out.push(*source as u8);
            out.extend_from_slice(&seq.to_le_bytes());
        }
        AtlasEvent::OracleTick { feed_id, price_q64, conf_q64, publish_slot, source, seq } => {
            out.extend_from_slice(&feed_id.to_le_bytes());
            out.extend_from_slice(&price_q64.to_le_bytes());
            out.extend_from_slice(&conf_q64.to_le_bytes());
            out.extend_from_slice(&publish_slot.to_le_bytes());
            out.push(*source as u8);
            out.extend_from_slice(&seq.to_le_bytes());
        }
        AtlasEvent::PoolStateChange { pool, slot, snapshot_hash, source, seq } => {
            out.extend_from_slice(pool);
            out.extend_from_slice(&slot.to_le_bytes());
            out.extend_from_slice(snapshot_hash);
            out.push(*source as u8);
            out.extend_from_slice(&seq.to_le_bytes());
        }
        AtlasEvent::SlotAdvance { slot, leader, parent } => {
            out.extend_from_slice(&slot.to_le_bytes());
            out.extend_from_slice(leader);
            out.extend_from_slice(&parent.to_le_bytes());
        }
        AtlasEvent::BundleStatusEvent { bundle_id, status, landed_slot } => {
            out.extend_from_slice(bundle_id);
            out.push(*status as u8);
            out.extend_from_slice(&landed_slot.unwrap_or(0).to_le_bytes());
            out.push(landed_slot.is_some() as u8);
        }
        AtlasEvent::HealthSignal { source, lag_slots, error_rate_bps } => {
            out.push(*source as u8);
            out.extend_from_slice(&lag_slots.to_le_bytes());
            out.extend_from_slice(&error_rate_bps.to_le_bytes());
        }
    }
    out
}

/// Content-addressed event id. Deterministic and collision-resistant.
pub fn event_id(e: &AtlasEvent) -> [u8; 32] {
    let bytes = canonical_event_bytes(e);
    blake3::hash(&bytes).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn account_update(seq: u64) -> AtlasEvent {
        AtlasEvent::AccountUpdate {
            pubkey: [1u8; 32],
            slot: 100,
            data_hash: [9u8; 32],
            data: Bytes::from_static(&[1, 2, 3]),
            source: SourceId::YellowstoneTriton,
            seq,
        }
    }

    #[test]
    fn event_id_deterministic() {
        let a = account_update(7);
        let b = account_update(7);
        assert_eq!(event_id(&a), event_id(&b));
    }

    #[test]
    fn event_id_changes_on_seq() {
        let a = account_update(7);
        let b = account_update(8);
        assert_ne!(event_id(&a), event_id(&b));
    }

    #[test]
    fn event_id_differs_across_sources() {
        let a = account_update(7);
        let mut b = account_update(7);
        if let AtlasEvent::AccountUpdate { source, .. } = &mut b {
            *source = SourceId::YellowstoneHelius;
        }
        assert_ne!(event_id(&a), event_id(&b));
    }

    #[test]
    fn commitment_classification() {
        assert!(account_update(0).is_commitment_bound());
        let advance = AtlasEvent::SlotAdvance { slot: 1, leader: [0u8; 32], parent: 0 };
        assert!(!advance.is_commitment_bound());
        let health = AtlasEvent::HealthSignal {
            source: SourceId::PythHermes,
            lag_slots: 0,
            error_rate_bps: 0,
        };
        assert!(!health.is_commitment_bound());
    }

    #[test]
    fn slot_anchor_returns_correct_field() {
        assert_eq!(account_update(0).slot(), 100);
        let bundle = AtlasEvent::BundleStatusEvent {
            bundle_id: [0u8; 32],
            status: BundleStatus::Landed,
            landed_slot: Some(555),
        };
        assert_eq!(bundle.slot(), 555);
    }
}

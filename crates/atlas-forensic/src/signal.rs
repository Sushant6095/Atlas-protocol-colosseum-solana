//! `ForensicSignal` enum + canonical encoding (directive §1.3).

use serde::{Deserialize, Serialize};

pub type Pubkey = [u8; 32];

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ProtocolId(pub u8);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum SignalKind {
    LargeStableExit = 1,
    WhaleEntry = 2,
    LiquidationCascade = 3,
    SmartMoneyMigration = 4,
    AbnormalWithdrawal = 5,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ForensicSignal {
    LargeStableExit {
        protocol: ProtocolId,
        amount_q64: u128,
        slot: u64,
    },
    WhaleEntry {
        protocol: ProtocolId,
        wallet: Pubkey,
        amount_q64: u128,
        slot: u64,
    },
    LiquidationCascade {
        protocol: ProtocolId,
        count_1m: u32,
        notional_q64: u128,
        slot: u64,
    },
    SmartMoneyMigration {
        from: ProtocolId,
        to: ProtocolId,
        wallets: Vec<Pubkey>,
        notional_q64: u128,
        slot: u64,
    },
    AbnormalWithdrawal {
        protocol: ProtocolId,
        amount_q64: u128,
        sigma: u32,
        slot: u64,
    },
}

impl ForensicSignal {
    pub fn kind(&self) -> SignalKind {
        match self {
            ForensicSignal::LargeStableExit { .. } => SignalKind::LargeStableExit,
            ForensicSignal::WhaleEntry { .. } => SignalKind::WhaleEntry,
            ForensicSignal::LiquidationCascade { .. } => SignalKind::LiquidationCascade,
            ForensicSignal::SmartMoneyMigration { .. } => SignalKind::SmartMoneyMigration,
            ForensicSignal::AbnormalWithdrawal { .. } => SignalKind::AbnormalWithdrawal,
        }
    }

    pub fn slot(&self) -> u64 {
        match self {
            ForensicSignal::LargeStableExit { slot, .. } => *slot,
            ForensicSignal::WhaleEntry { slot, .. } => *slot,
            ForensicSignal::LiquidationCascade { slot, .. } => *slot,
            ForensicSignal::SmartMoneyMigration { slot, .. } => *slot,
            ForensicSignal::AbnormalWithdrawal { slot, .. } => *slot,
        }
    }
}

/// Canonical byte encoding — used to compute `signal_id`. Stable across
/// machines and Rust toolchain upgrades. Adding a field to any variant
/// requires bumping the variant tag.
pub fn canonical_signal_bytes(s: &ForensicSignal) -> Vec<u8> {
    let mut out = Vec::with_capacity(96);
    out.push(s.kind() as u8);
    match s {
        ForensicSignal::LargeStableExit { protocol, amount_q64, slot } => {
            out.push(protocol.0);
            out.extend_from_slice(&amount_q64.to_le_bytes());
            out.extend_from_slice(&slot.to_le_bytes());
        }
        ForensicSignal::WhaleEntry { protocol, wallet, amount_q64, slot } => {
            out.push(protocol.0);
            out.extend_from_slice(wallet);
            out.extend_from_slice(&amount_q64.to_le_bytes());
            out.extend_from_slice(&slot.to_le_bytes());
        }
        ForensicSignal::LiquidationCascade { protocol, count_1m, notional_q64, slot } => {
            out.push(protocol.0);
            out.extend_from_slice(&count_1m.to_le_bytes());
            out.extend_from_slice(&notional_q64.to_le_bytes());
            out.extend_from_slice(&slot.to_le_bytes());
        }
        ForensicSignal::SmartMoneyMigration { from, to, wallets, notional_q64, slot } => {
            out.push(from.0);
            out.push(to.0);
            // Sort wallets for deterministic encoding.
            let mut sorted = wallets.clone();
            sorted.sort();
            sorted.dedup();
            out.extend_from_slice(&(sorted.len() as u32).to_le_bytes());
            for w in &sorted {
                out.extend_from_slice(w);
            }
            out.extend_from_slice(&notional_q64.to_le_bytes());
            out.extend_from_slice(&slot.to_le_bytes());
        }
        ForensicSignal::AbnormalWithdrawal { protocol, amount_q64, sigma, slot } => {
            out.push(protocol.0);
            out.extend_from_slice(&amount_q64.to_le_bytes());
            out.extend_from_slice(&sigma.to_le_bytes());
            out.extend_from_slice(&slot.to_le_bytes());
        }
    }
    out
}

pub fn signal_id(s: &ForensicSignal) -> [u8; 32] {
    let bytes = canonical_signal_bytes(s);
    blake3::hash(&bytes).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s_large(amount: u128, slot: u64) -> ForensicSignal {
        ForensicSignal::LargeStableExit { protocol: ProtocolId(1), amount_q64: amount, slot }
    }

    #[test]
    fn signal_id_deterministic() {
        let a = s_large(1_000_000, 100);
        let b = s_large(1_000_000, 100);
        assert_eq!(signal_id(&a), signal_id(&b));
    }

    #[test]
    fn signal_id_changes_on_amount() {
        let a = s_large(1_000_000, 100);
        let b = s_large(2_000_000, 100);
        assert_ne!(signal_id(&a), signal_id(&b));
    }

    #[test]
    fn migration_wallet_order_is_normalized() {
        let s_a = ForensicSignal::SmartMoneyMigration {
            from: ProtocolId(1),
            to: ProtocolId(2),
            wallets: vec![[3u8; 32], [1u8; 32], [2u8; 32]],
            notional_q64: 1_000,
            slot: 100,
        };
        let s_b = ForensicSignal::SmartMoneyMigration {
            from: ProtocolId(1),
            to: ProtocolId(2),
            wallets: vec![[1u8; 32], [3u8; 32], [2u8; 32]],
            notional_q64: 1_000,
            slot: 100,
        };
        assert_eq!(signal_id(&s_a), signal_id(&s_b));
    }

    #[test]
    fn migration_wallet_dedup() {
        let s_a = ForensicSignal::SmartMoneyMigration {
            from: ProtocolId(1),
            to: ProtocolId(2),
            wallets: vec![[1u8; 32], [1u8; 32], [2u8; 32]],
            notional_q64: 1_000,
            slot: 100,
        };
        let s_b = ForensicSignal::SmartMoneyMigration {
            from: ProtocolId(1),
            to: ProtocolId(2),
            wallets: vec![[1u8; 32], [2u8; 32]],
            notional_q64: 1_000,
            slot: 100,
        };
        assert_eq!(signal_id(&s_a), signal_id(&s_b));
    }

    #[test]
    fn kinds_are_distinct() {
        let kinds: Vec<u8> = [
            SignalKind::LargeStableExit,
            SignalKind::WhaleEntry,
            SignalKind::LiquidationCascade,
            SignalKind::SmartMoneyMigration,
            SignalKind::AbnormalWithdrawal,
        ]
        .iter()
        .map(|k| *k as u8)
        .collect();
        let mut sorted = kinds.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), kinds.len());
    }
}

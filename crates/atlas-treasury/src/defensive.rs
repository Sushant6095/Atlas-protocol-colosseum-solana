//! Stable-vault defensive trigger ladder (directive §7.1).
//!
//! Maps `StableIntelSignal` rows to the corresponding defensive
//! action. The ladder is per-trigger and short-circuits the moment a
//! harder action fires:
//!
//! * `PegDeviation` on the deposit asset → defensive immediately.
//! * `StablePoolDepthCollapse` on a venue Atlas is exposed to →
//!   defensive + protocol isolation for that venue.
//! * `IssuerEvent { kind: AuthorityChange }` on the deposit mint →
//!   `FrozenDeposit` (no new deposits accepted; existing capital
//!   keeps earning; withdrawals continue).

use crate::intel::{IssuerEventKind, StableIntelSignal};
use atlas_failure::class::ProtocolId;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum StableDefensiveAction {
    /// Engage defensive vector immediately. No protocol isolated.
    Defensive { reason: String },
    /// Engage defensive vector AND isolate one protocol from the
    /// allocation universe for the rest of the cooldown window.
    DefensiveAndIsolate { reason: String, isolated_protocol: ProtocolId },
    /// Vault refuses new deposits; existing capital keeps earning;
    /// withdrawals continue. Triggered by issuer authority change on
    /// the deposit mint — surfaces to governance for review.
    FrozenDeposit { reason: String },
}

impl StableDefensiveAction {
    pub fn reason(&self) -> &str {
        match self {
            StableDefensiveAction::Defensive { reason } => reason,
            StableDefensiveAction::DefensiveAndIsolate { reason, .. } => reason,
            StableDefensiveAction::FrozenDeposit { reason } => reason,
        }
    }
}

/// Evaluate a window of intel signals and return the defensive
/// actions a stable vault should take. The vault's deposit mint and
/// the `pool_to_protocol` map (which Atlas builds at vault creation)
/// pin the rules to the vault's actual exposure.
pub fn evaluate_stable_defensive(
    deposit_mint: &Pubkey,
    pool_to_protocol: &BTreeMap<Pubkey, ProtocolId>,
    signals: &[StableIntelSignal],
) -> Vec<StableDefensiveAction> {
    let mut actions = Vec::new();
    for s in signals {
        match s {
            StableIntelSignal::PegDeviation { mint, deviation_bps, .. } => {
                if mint == deposit_mint {
                    actions.push(StableDefensiveAction::Defensive {
                        reason: format!("peg_deviation_{deviation_bps}bps_on_deposit_asset"),
                    });
                }
            }
            StableIntelSignal::StablePoolDepthCollapse { pool, depth_drop_bps, .. } => {
                if let Some(protocol) = pool_to_protocol.get(pool) {
                    actions.push(StableDefensiveAction::DefensiveAndIsolate {
                        reason: format!("pool_depth_collapse_{depth_drop_bps}bps"),
                        isolated_protocol: *protocol,
                    });
                }
            }
            StableIntelSignal::IssuerEvent { mint, kind, .. } => {
                if mint == deposit_mint && *kind == IssuerEventKind::AuthorityChange {
                    actions.push(StableDefensiveAction::FrozenDeposit {
                        reason: "issuer_authority_change_on_deposit_mint".into(),
                    });
                }
            }
            // Flow spike + non-deposit-mint events feed dashboards
            // and Phase 05 alerts but don't auto-shift posture.
            _ => {}
        }
    }
    actions
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intel::{IssuerEventKind, StableFlowDirection, StableIntelSignal};

    fn k(b: u8) -> Pubkey { [b; 32] }

    fn pool_map() -> BTreeMap<Pubkey, ProtocolId> {
        let mut m = BTreeMap::new();
        m.insert(k(7), ProtocolId(1)); // pool 7 → kamino
        m.insert(k(8), ProtocolId(3)); // pool 8 → marginfi
        m
    }

    #[test]
    fn peg_deviation_on_deposit_mint_triggers_defensive() {
        let signals = vec![StableIntelSignal::PegDeviation {
            mint: k(0xab),
            deviation_bps: 80,
            source: "twap".into(),
            slot: 100,
        }];
        let actions = evaluate_stable_defensive(&k(0xab), &pool_map(), &signals);
        assert_eq!(actions.len(), 1);
        assert!(matches!(actions[0], StableDefensiveAction::Defensive { .. }));
    }

    #[test]
    fn peg_deviation_on_other_mint_is_ignored() {
        let signals = vec![StableIntelSignal::PegDeviation {
            mint: k(0xff),
            deviation_bps: 80,
            source: "twap".into(),
            slot: 100,
        }];
        let actions = evaluate_stable_defensive(&k(0xab), &pool_map(), &signals);
        assert!(actions.is_empty());
    }

    #[test]
    fn depth_collapse_isolates_protocol() {
        let signals = vec![StableIntelSignal::StablePoolDepthCollapse {
            pool: k(7),
            mint: k(0xab),
            depth_drop_bps: 5_000,
            slot: 100,
        }];
        let actions = evaluate_stable_defensive(&k(0xab), &pool_map(), &signals);
        assert_eq!(actions.len(), 1);
        match &actions[0] {
            StableDefensiveAction::DefensiveAndIsolate { isolated_protocol, .. } => {
                assert_eq!(*isolated_protocol, ProtocolId(1));
            }
            _ => panic!("expected DefensiveAndIsolate"),
        }
    }

    #[test]
    fn depth_collapse_on_unknown_pool_is_ignored() {
        let signals = vec![StableIntelSignal::StablePoolDepthCollapse {
            pool: k(99),
            mint: k(0xab),
            depth_drop_bps: 9_000,
            slot: 100,
        }];
        let actions = evaluate_stable_defensive(&k(0xab), &pool_map(), &signals);
        assert!(actions.is_empty());
    }

    #[test]
    fn issuer_authority_change_freezes_deposits() {
        let signals = vec![StableIntelSignal::IssuerEvent {
            mint: k(0xab),
            kind: IssuerEventKind::AuthorityChange,
            slot: 100,
        }];
        let actions = evaluate_stable_defensive(&k(0xab), &pool_map(), &signals);
        assert!(matches!(actions[0], StableDefensiveAction::FrozenDeposit { .. }));
    }

    #[test]
    fn issuer_mint_spike_does_not_freeze() {
        let signals = vec![StableIntelSignal::IssuerEvent {
            mint: k(0xab),
            kind: IssuerEventKind::MintMintedSpike,
            slot: 100,
        }];
        let actions = evaluate_stable_defensive(&k(0xab), &pool_map(), &signals);
        // Mint spike surfaces to governance via alerts, but doesn't
        // auto-shift posture per directive §7.1.
        assert!(actions.is_empty());
    }

    #[test]
    fn flow_spike_does_not_auto_shift_posture() {
        let signals = vec![StableIntelSignal::StableFlowSpike {
            mint: k(0xab),
            direction: StableFlowDirection::Outflow,
            notional_q64: 1_000_000,
            window_ms: 1_000,
            slot: 100,
        }];
        let actions = evaluate_stable_defensive(&k(0xab), &pool_map(), &signals);
        assert!(actions.is_empty());
    }
}

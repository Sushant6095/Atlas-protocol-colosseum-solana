//! Complex event processor (CEP) layer.
//!
//! Pure-function triggers over a deterministic event stream. Replay of the
//! same input must produce the same trigger sequence — daily CI asserts this
//! against 24h of production traffic.

use crate::event::{AtlasEvent, FeedId, OracleSource, Pubkey, SourceId};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AnomalyTrigger {
    VolatilitySpike { feed_id: FeedId, severity_bps: u32 },
    OracleDrift { feed_id: FeedId, deviation_bps: u32 },
    LiquidityCollapse { pool: Pubkey, depth_delta_bps: i32, window_ms: u32 },
    ProtocolUtilizationSpike { protocol_pubkey: Pubkey, util_bps: u32 },
    WhaleExit { wallet: Pubkey, protocol_pubkey: Pubkey, notional_q64: i128, direction_out: bool },
    FeedStall { feed_id: FeedId, stale_slots: u64 },
    RpcSplit { sources: Vec<SourceId> },
}

#[derive(Clone, Copy, Debug)]
pub struct AnomalyConfig {
    pub volatility_severity_threshold_bps: u32, // 30_000 ≈ 3× median
    pub oracle_deviation_threshold_bps: u32,
    pub liquidity_collapse_threshold_bps: u32,  // 4_000 = 40%
    pub utilization_spike_bps: u32,             // 9_500
    pub whale_exit_protocol_tvl_bps: u32,       // 100 = 1%
    pub feed_stall_slots: u64,
}

impl Default for AnomalyConfig {
    fn default() -> Self {
        Self {
            volatility_severity_threshold_bps: 30_000,
            oracle_deviation_threshold_bps: 50,
            liquidity_collapse_threshold_bps: 4_000,
            utilization_spike_bps: 9_500,
            whale_exit_protocol_tvl_bps: 100,
            feed_stall_slots: 64,
        }
    }
}

/// Account directory for utilization + whale-exit triggers. Caller
/// pre-registers which on-chain account proxies which protocol (utilization
/// reading) or wallet/protocol pair (balance for whale exit). Phase 2 wires
/// real decoders; Phase 1 derives values from `data_hash`.
#[derive(Clone, Debug, Default)]
pub struct AccountDirectory {
    /// `account_pubkey → protocol_pubkey` for utilization-bps proxy reads.
    pub utilization_accounts: BTreeMap<Pubkey, Pubkey>,
    /// `account_pubkey → (wallet, protocol, protocol_tvl_q64)` for whale-exit
    /// detection. The protocol_tvl is used as the denominator for the 1%
    /// threshold; caller refreshes it as TVL moves.
    pub wallet_accounts: BTreeMap<Pubkey, (Pubkey, Pubkey, i128)>,
}

pub struct AnomalyEngine {
    config: AnomalyConfig,
    directory: AccountDirectory,
    /// Per-feed volatility median (bps), maintained as an EMA of realized vol.
    feed_volatility_median_bps: BTreeMap<FeedId, u32>,
    /// Per-feed last-seen slot for stall detection.
    feed_last_slot: BTreeMap<FeedId, u64>,
    /// Per-feed last price by oracle source.
    feed_last_price: BTreeMap<(FeedId, OracleSource), i64>,
    /// Per-pool last depth at ±1% (bps of TVL) and timestamp slot for delta calc.
    pool_last_depth: BTreeMap<Pubkey, (u32, u64)>,
    /// Per-account last balance for whale-exit detection.
    account_last_balance: BTreeMap<Pubkey, i128>,
}

impl AnomalyEngine {
    pub fn new(config: AnomalyConfig) -> Self {
        Self::with_directory(config, AccountDirectory::default())
    }

    pub fn with_directory(config: AnomalyConfig, directory: AccountDirectory) -> Self {
        Self {
            config,
            directory,
            feed_volatility_median_bps: BTreeMap::new(),
            feed_last_slot: BTreeMap::new(),
            feed_last_price: BTreeMap::new(),
            pool_last_depth: BTreeMap::new(),
            account_last_balance: BTreeMap::new(),
        }
    }

    /// Inform the CEP layer that the quorum engine produced a non-Confirmed
    /// outcome. Emits `RpcSplit` when the disagreement is hard or total.
    pub fn observe_quorum_disagreement(
        &mut self,
        sources: &[crate::event::SourceId],
    ) -> Vec<AnomalyTrigger> {
        if sources.is_empty() {
            return vec![];
        }
        let mut sorted: Vec<crate::event::SourceId> = sources.to_vec();
        sorted.sort_by_key(|s| *s as u8);
        sorted.dedup();
        vec![AnomalyTrigger::RpcSplit { sources: sorted }]
    }

    /// Process a single event; return any triggers it produced. The CEP layer
    /// is intentionally stateless across events except for the small bounded
    /// state on `self`.
    pub fn ingest(&mut self, event: &AtlasEvent) -> Vec<AnomalyTrigger> {
        let mut triggers = Vec::new();
        match event {
            AtlasEvent::AccountUpdate { pubkey, data_hash, slot: _slot, .. } => {
                if let Some(protocol_pubkey) = self.directory.utilization_accounts.get(pubkey) {
                    let util_bps = (data_hash[0] as u32) * 39;
                    if util_bps >= self.config.utilization_spike_bps {
                        triggers.push(AnomalyTrigger::ProtocolUtilizationSpike {
                            protocol_pubkey: *protocol_pubkey,
                            util_bps,
                        });
                    }
                }
                if let Some((wallet, protocol_pubkey, tvl_q64)) =
                    self.directory.wallet_accounts.get(pubkey)
                {
                    let mut buf = [0u8; 8];
                    buf.copy_from_slice(&data_hash[0..8]);
                    let balance_q64 = i64::from_le_bytes(buf) as i128;
                    let prev = self.account_last_balance.insert(*pubkey, balance_q64);
                    if let Some(prev_balance) = prev {
                        let delta = balance_q64 - prev_balance;
                        let abs_delta = delta.abs();
                        if *tvl_q64 > 0 {
                            let frac_bps =
                                (abs_delta * 10_000 / tvl_q64.abs()) as u32;
                            if frac_bps >= self.config.whale_exit_protocol_tvl_bps {
                                triggers.push(AnomalyTrigger::WhaleExit {
                                    wallet: *wallet,
                                    protocol_pubkey: *protocol_pubkey,
                                    notional_q64: abs_delta,
                                    direction_out: delta < 0,
                                });
                            }
                        }
                    }
                }
            }
            AtlasEvent::OracleTick { feed_id, price_q64, publish_slot, source, .. } => {
                self.feed_last_slot.insert(*feed_id, *publish_slot);
                let prev = self.feed_last_price.insert((*feed_id, *source), *price_q64);
                if let Some(prev_price) = prev {
                    if prev_price != 0 {
                        let delta = (price_q64.saturating_sub(prev_price)).abs();
                        let bps = ((delta as i128) * 10_000 / prev_price.abs().max(1) as i128) as u32;
                        // Update volatility EMA (alpha 5%).
                        let entry = self
                            .feed_volatility_median_bps
                            .entry(*feed_id)
                            .or_insert(bps);
                        *entry = ((*entry as u64 * 95 + bps as u64 * 5) / 100) as u32;
                        let median = *entry;
                        if median > 0 && bps > median.saturating_mul(3) {
                            let severity_bps = (bps as u64).saturating_mul(10_000) / median.max(1) as u64;
                            triggers.push(AnomalyTrigger::VolatilitySpike {
                                feed_id: *feed_id,
                                severity_bps: severity_bps.min(u32::MAX as u64) as u32,
                            });
                        }
                    }
                }

                // Cross-source oracle drift.
                let pyth = self.feed_last_price.get(&(*feed_id, OracleSource::PythHermes));
                let sb = self.feed_last_price.get(&(*feed_id, OracleSource::SwitchboardOnDemand));
                if let (Some(p), Some(s)) = (pyth, sb) {
                    if *p != 0 {
                        let dev = (p - s).abs();
                        let dev_bps = ((dev as i128) * 10_000 / p.abs().max(1) as i128) as u32;
                        if dev_bps > self.config.oracle_deviation_threshold_bps {
                            triggers.push(AnomalyTrigger::OracleDrift {
                                feed_id: *feed_id,
                                deviation_bps: dev_bps,
                            });
                        }
                    }
                }
            }
            AtlasEvent::PoolStateChange { pool, slot, snapshot_hash, .. } => {
                // Use first byte of snapshot_hash as a coarse "depth proxy" so
                // tests can drive deterministic triggers without a real depth
                // computation (Phase 2 wires an actual liquidity decoder).
                let proxy_depth_bps = (snapshot_hash[0] as u32) * 39; // 0..=9_945
                if let Some((prev_depth, prev_slot)) = self.pool_last_depth.insert(*pool, (proxy_depth_bps, *slot)) {
                    let delta = proxy_depth_bps as i32 - prev_depth as i32;
                    if delta < 0 && delta.abs() as u32 >= self.config.liquidity_collapse_threshold_bps {
                        triggers.push(AnomalyTrigger::LiquidityCollapse {
                            pool: *pool,
                            depth_delta_bps: delta,
                            window_ms: ((slot.saturating_sub(prev_slot) * 400).min(u32::MAX as u64))
                                as u32,
                        });
                    }
                }
            }
            _ => {}
        }
        triggers
    }

    /// Sweep for stale feeds. Caller drives this on a slot tick (deterministic
    /// ordering: sweep occurs after all events at slot S are ingested).
    pub fn check_stalls(&self, current_slot: u64) -> Vec<AnomalyTrigger> {
        let mut out = Vec::new();
        for (feed_id, last) in &self.feed_last_slot {
            let stale = current_slot.saturating_sub(*last);
            if stale > self.config.feed_stall_slots {
                out.push(AnomalyTrigger::FeedStall {
                    feed_id: *feed_id,
                    stale_slots: stale,
                });
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::SourceId;

    fn account_update(pubkey: Pubkey, data_hash: [u8; 32], slot: u64) -> AtlasEvent {
        AtlasEvent::AccountUpdate {
            pubkey,
            slot,
            data_hash,
            data: bytes::Bytes::from_static(&[]),
            source: SourceId::YellowstoneTriton,
            seq: slot,
        }
    }

    #[test]
    fn protocol_utilization_spike_above_threshold() {
        let mut dir = AccountDirectory::default();
        let acc = [10u8; 32];
        let proto = [99u8; 32];
        dir.utilization_accounts.insert(acc, proto);
        let mut e = AnomalyEngine::with_directory(AnomalyConfig::default(), dir);
        // data_hash[0] = 250 → 250 * 39 = 9_750 bps (≥ default threshold 9_500)
        let triggers = e.ingest(&account_update(acc, [250u8; 32], 100));
        assert!(triggers.iter().any(|t| matches!(
            t,
            AnomalyTrigger::ProtocolUtilizationSpike { util_bps, .. } if *util_bps >= 9_500
        )));
    }

    #[test]
    fn protocol_utilization_skipped_below_threshold() {
        let mut dir = AccountDirectory::default();
        let acc = [10u8; 32];
        dir.utilization_accounts.insert(acc, [99u8; 32]);
        let mut e = AnomalyEngine::with_directory(AnomalyConfig::default(), dir);
        let triggers = e.ingest(&account_update(acc, [100u8; 32], 100));
        assert!(!triggers
            .iter()
            .any(|t| matches!(t, AnomalyTrigger::ProtocolUtilizationSpike { .. })));
    }

    #[test]
    fn whale_exit_fires_on_balance_drop() {
        let mut dir = AccountDirectory::default();
        let acc = [11u8; 32];
        let wallet = [22u8; 32];
        let proto = [33u8; 32];
        dir.wallet_accounts.insert(acc, (wallet, proto, 1_000_000));
        let mut e = AnomalyEngine::with_directory(AnomalyConfig::default(), dir);
        let mut h1 = [0u8; 32];
        h1[..8].copy_from_slice(&500_000i64.to_le_bytes());
        let _ = e.ingest(&account_update(acc, h1, 100));
        let mut h2 = [0u8; 32];
        h2[..8].copy_from_slice(&50_000i64.to_le_bytes());
        let triggers = e.ingest(&account_update(acc, h2, 101));
        assert!(triggers.iter().any(|t| matches!(
            t,
            AnomalyTrigger::WhaleExit { direction_out: true, .. }
        )));
    }

    #[test]
    fn rpc_split_emitted_on_quorum_disagreement() {
        let mut e = AnomalyEngine::new(AnomalyConfig::default());
        let triggers = e.observe_quorum_disagreement(&[
            SourceId::YellowstoneTriton,
            SourceId::YellowstoneHelius,
            SourceId::YellowstoneQuickNode,
        ]);
        assert_eq!(triggers.len(), 1);
        assert!(matches!(
            &triggers[0],
            AnomalyTrigger::RpcSplit { sources } if sources.len() == 3
        ));
    }

    #[test]
    fn rpc_split_empty_inputs_yields_no_trigger() {
        let mut e = AnomalyEngine::new(AnomalyConfig::default());
        assert!(e.observe_quorum_disagreement(&[]).is_empty());
    }

    fn tick(feed: FeedId, source: OracleSource, price: i64, slot: u64, seq: u64) -> AtlasEvent {
        AtlasEvent::OracleTick {
            feed_id: feed,
            price_q64: price,
            conf_q64: 1,
            publish_slot: slot,
            source,
            seq,
        }
    }

    #[test]
    fn oracle_drift_triggers_when_pyth_switchboard_diverge() {
        let mut e = AnomalyEngine::new(AnomalyConfig::default());
        // Prime both feeds.
        let _ = e.ingest(&tick(1, OracleSource::PythHermes, 100_000, 100, 1));
        let triggers = e.ingest(&tick(1, OracleSource::SwitchboardOnDemand, 110_000, 101, 2));
        // 10% deviation > 50 bps threshold.
        assert!(triggers
            .iter()
            .any(|t| matches!(t, AnomalyTrigger::OracleDrift { .. })));
    }

    #[test]
    fn no_oracle_drift_when_within_threshold() {
        let mut e = AnomalyEngine::new(AnomalyConfig::default());
        let _ = e.ingest(&tick(1, OracleSource::PythHermes, 100_000, 100, 1));
        let triggers = e.ingest(&tick(1, OracleSource::SwitchboardOnDemand, 100_001, 101, 2));
        assert!(triggers
            .iter()
            .all(|t| !matches!(t, AnomalyTrigger::OracleDrift { .. })));
    }

    #[test]
    fn feed_stall_detected() {
        let mut e = AnomalyEngine::new(AnomalyConfig::default());
        let _ = e.ingest(&tick(7, OracleSource::PythHermes, 100, 100, 1));
        let triggers = e.check_stalls(200);
        assert!(triggers
            .iter()
            .any(|t| matches!(t, AnomalyTrigger::FeedStall { feed_id: 7, .. })));
    }

    #[test]
    fn volatility_spike_after_calm_then_jump() {
        let mut e = AnomalyEngine::new(AnomalyConfig::default());
        // Calm regime — small ticks build a small median.
        let mut price = 100_000;
        for slot in 100..150 {
            price += 50; // 0.05% per tick
            let _ = e.ingest(&tick(11, OracleSource::PythHermes, price, slot, slot));
        }
        // Sudden 10% jump.
        let triggers = e.ingest(&tick(11, OracleSource::PythHermes, price + 10_000, 151, 9999));
        assert!(triggers
            .iter()
            .any(|t| matches!(t, AnomalyTrigger::VolatilitySpike { feed_id: 11, .. })));
    }

    #[test]
    fn liquidity_collapse_on_pool_change() {
        let mut e = AnomalyEngine::new(AnomalyConfig::default());
        let pool = [3u8; 32];
        // First snapshot: hash[0] = 200 → depth proxy 200*39 = 7_800 bps
        let snap1 = AtlasEvent::PoolStateChange {
            pool,
            slot: 100,
            snapshot_hash: [200u8; 32],
            source: SourceId::Orca,
            seq: 1,
        };
        let _ = e.ingest(&snap1);
        // Second snapshot: hash[0] = 0 → depth proxy 0 → drop 7_800 bps
        let snap2 = AtlasEvent::PoolStateChange {
            pool,
            slot: 110,
            snapshot_hash: [0u8; 32],
            source: SourceId::Orca,
            seq: 2,
        };
        let triggers = e.ingest(&snap2);
        assert!(triggers
            .iter()
            .any(|t| matches!(t, AnomalyTrigger::LiquidityCollapse { .. })));
    }

    #[test]
    fn replay_parity_same_input_same_triggers() {
        // Same event sequence into two independent engines must yield the
        // same trigger sequence — replay parity.
        let mut a = AnomalyEngine::new(AnomalyConfig::default());
        let mut b = AnomalyEngine::new(AnomalyConfig::default());
        let mut ts_a = Vec::new();
        let mut ts_b = Vec::new();
        for slot in 100..120 {
            let e1 = tick(99, OracleSource::PythHermes, 1_000 + slot as i64, slot, slot);
            let e2 = tick(99, OracleSource::SwitchboardOnDemand, 1_000 + slot as i64, slot, slot * 2);
            ts_a.extend(a.ingest(&e1));
            ts_a.extend(a.ingest(&e2));
            ts_b.extend(b.ingest(&e1));
            ts_b.extend(b.ingest(&e2));
        }
        assert_eq!(ts_a, ts_b);
    }
}

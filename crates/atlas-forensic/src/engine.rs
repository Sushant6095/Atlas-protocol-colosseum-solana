//! `ForensicEngine` — composes the four heuristics and emits typed signals.

use crate::heuristics::{
    AbnormalWithdrawalTracker, ForensicConfig, LiquidationCascadeTracker, ProtocolFlowTracker,
    SmartMoneyMigrationTracker,
};
use crate::signal::{ForensicSignal, ProtocolId, Pubkey};

#[derive(Clone, Copy, Debug)]
pub struct ForensicEngineConfig {
    pub forensic: ForensicConfig,
}

impl Default for ForensicEngineConfig {
    fn default() -> Self {
        Self { forensic: ForensicConfig::default() }
    }
}

/// Stateful engine. Caller drives via per-event `observe_*` methods. The
/// engine itself never reaches out to the network — only commitment-bound
/// inputs come through here. Live-network enrichment (Solscan, Birdeye)
/// runs in a separate dashboard surface (Phase 06).
pub struct ForensicEngine {
    config: ForensicEngineConfig,
    liquidation: LiquidationCascadeTracker,
    migration: SmartMoneyMigrationTracker,
    abnormal: AbnormalWithdrawalTracker,
}

impl ForensicEngine {
    pub fn new(config: ForensicEngineConfig) -> Self {
        Self {
            config,
            liquidation: LiquidationCascadeTracker::default(),
            migration: SmartMoneyMigrationTracker::default(),
            abnormal: AbnormalWithdrawalTracker::default(),
        }
    }

    pub fn observe_protocol_withdrawal(
        &mut self,
        protocol: ProtocolId,
        amount_q64: u128,
        slot: u64,
    ) -> Vec<ForensicSignal> {
        let mut out = Vec::new();
        if let Some(s) =
            ProtocolFlowTracker::check_large_exit(&self.config.forensic, protocol, amount_q64, slot)
        {
            out.push(s);
        }
        if let Some(s) = self
            .abnormal
            .observe(&self.config.forensic, protocol, amount_q64, slot)
        {
            out.push(s);
        }
        out
    }

    pub fn observe_protocol_deposit(
        &mut self,
        protocol: ProtocolId,
        wallet: Pubkey,
        amount_q64: u128,
        slot: u64,
    ) -> Vec<ForensicSignal> {
        let mut out = Vec::new();
        if let Some(s) = ProtocolFlowTracker::check_whale_entry(
            &self.config.forensic,
            protocol,
            wallet,
            amount_q64,
            slot,
        ) {
            out.push(s);
        }
        out
    }

    pub fn observe_liquidation(
        &mut self,
        protocol: ProtocolId,
        notional_q64: u128,
        slot: u64,
    ) -> Vec<ForensicSignal> {
        match self
            .liquidation
            .record(&self.config.forensic, protocol, notional_q64, slot)
        {
            Some(s) => vec![s],
            None => vec![],
        }
    }

    pub fn observe_wallet_shift(
        &mut self,
        wallet: Pubkey,
        from: ProtocolId,
        to: ProtocolId,
        outflow_q64: u128,
        wallet_total_q64: u128,
        slot: u64,
    ) -> Vec<ForensicSignal> {
        match self.migration.update(
            &self.config.forensic,
            wallet,
            from,
            to,
            outflow_q64,
            wallet_total_q64,
            slot,
        ) {
            Some(s) => vec![s],
            None => vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn engine_emits_large_exit_and_abnormal() {
        let mut e = ForensicEngine::new(ForensicEngineConfig::default());
        // Prime the abnormal-withdrawal stats with varied small values so
        // Welford stddev > 0 and the σ threshold can fire later.
        for s in 0..64u64 {
            let amt = 1_000u128 + (s as u128 % 50);
            e.observe_protocol_withdrawal(ProtocolId(1), amt, s);
        }
        // Now a withdrawal that exceeds large_stable_exit_threshold AND is
        // ≥5σ above the running mean.
        let big_amount: u128 = 200_000u128 << 64;
        let signals = e.observe_protocol_withdrawal(ProtocolId(1), big_amount, 100);
        assert!(signals
            .iter()
            .any(|s| matches!(s, ForensicSignal::LargeStableExit { .. })));
        assert!(signals
            .iter()
            .any(|s| matches!(s, ForensicSignal::AbnormalWithdrawal { .. })));
    }

    #[test]
    fn engine_emits_liquidation_cascade() {
        let mut e = ForensicEngine::new(ForensicEngineConfig::default());
        for i in 0..7 {
            assert!(e.observe_liquidation(ProtocolId(1), 1_000, 100 + i).is_empty());
        }
        let signals = e.observe_liquidation(ProtocolId(1), 1_000, 107);
        assert_eq!(signals.len(), 1);
    }

    #[test]
    fn engine_emits_whale_entry() {
        let mut e = ForensicEngine::new(ForensicEngineConfig::default());
        let big_amount: u128 = 200_000u128 << 64;
        let signals = e.observe_protocol_deposit(ProtocolId(1), [9u8; 32], big_amount, 100);
        assert!(matches!(
            signals[0],
            ForensicSignal::WhaleEntry { wallet, .. } if wallet == [9u8; 32]
        ));
    }
}

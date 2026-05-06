//! Invoice intelligence (directive §6).
//!
//! Open invoices = pending AR. Atlas tracks them as a treasury input
//! to the runway forecast. Same hard rule as everything else in this
//! crate: invoice metadata is monitoring + scheduling, never a
//! commitment input.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    /// Issued, payment expected.
    Open,
    /// Past due.
    Overdue,
    /// Settled in full.
    Paid,
    /// Written off.
    Uncollectable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceRecord {
    pub invoice_id: String,
    pub treasury_id: Pubkey,
    pub amount_q64: u128,
    pub mint: String,
    pub issued_at_slot: u64,
    pub due_at_slot: u64,
    /// Settlement distribution centre — typical days-to-settle for
    /// this customer based on historical data.
    pub expected_settle_days_p50: u32,
    pub expected_settle_days_p90: u32,
    pub status: InvoiceStatus,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct SettlementDistribution {
    pub p10_days: u32,
    pub p50_days: u32,
    pub p90_days: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct InvoiceLedger {
    pub records: Vec<InvoiceRecord>,
}

impl InvoiceLedger {
    pub fn new() -> Self { Self::default() }

    pub fn open_balance_q64(&self) -> u128 {
        self.records
            .iter()
            .filter(|r| matches!(r.status, InvoiceStatus::Open | InvoiceStatus::Overdue))
            .map(|r| r.amount_q64)
            .sum()
    }

    pub fn overdue_count(&self) -> usize {
        self.records
            .iter()
            .filter(|r| r.status == InvoiceStatus::Overdue)
            .count()
    }

    /// Build a settlement distribution across all currently open
    /// invoices weighted by amount.
    pub fn settlement_distribution(&self) -> SettlementDistribution {
        let open: Vec<&InvoiceRecord> = self
            .records
            .iter()
            .filter(|r| matches!(r.status, InvoiceStatus::Open | InvoiceStatus::Overdue))
            .collect();
        if open.is_empty() {
            return SettlementDistribution::default();
        }
        let mut weighted_p50: u128 = 0;
        let mut weighted_p90: u128 = 0;
        let mut total: u128 = 0;
        for r in &open {
            weighted_p50 = weighted_p50.saturating_add(
                (r.expected_settle_days_p50 as u128).saturating_mul(r.amount_q64),
            );
            weighted_p90 = weighted_p90.saturating_add(
                (r.expected_settle_days_p90 as u128).saturating_mul(r.amount_q64),
            );
            total = total.saturating_add(r.amount_q64);
        }
        let avg_p50 = (weighted_p50 / total.max(1)) as u32;
        let avg_p90 = (weighted_p90 / total.max(1)) as u32;
        SettlementDistribution {
            p10_days: (avg_p50 / 2).max(1),
            p50_days: avg_p50,
            p90_days: avg_p90,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceIntelligence {
    pub treasury_id: Pubkey,
    pub open_balance_q64: u128,
    pub overdue_count: u32,
    pub settlement_distribution: SettlementDistribution,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inv(id: &str, amt: u128, status: InvoiceStatus, p50: u32, p90: u32) -> InvoiceRecord {
        InvoiceRecord {
            invoice_id: id.into(),
            treasury_id: [1u8; 32],
            amount_q64: amt,
            mint: "USDC".into(),
            issued_at_slot: 0,
            due_at_slot: 1_000,
            expected_settle_days_p50: p50,
            expected_settle_days_p90: p90,
            status,
        }
    }

    #[test]
    fn open_balance_sums_open_and_overdue() {
        let mut l = InvoiceLedger::new();
        l.records.push(inv("a", 1_000, InvoiceStatus::Open, 14, 30));
        l.records.push(inv("b", 2_000, InvoiceStatus::Overdue, 30, 60));
        l.records.push(inv("c", 5_000, InvoiceStatus::Paid, 0, 0));
        l.records.push(inv("d", 500, InvoiceStatus::Uncollectable, 0, 0));
        assert_eq!(l.open_balance_q64(), 3_000);
    }

    #[test]
    fn overdue_count_counts_only_overdue() {
        let mut l = InvoiceLedger::new();
        l.records.push(inv("a", 100, InvoiceStatus::Open, 14, 30));
        l.records.push(inv("b", 200, InvoiceStatus::Overdue, 30, 60));
        l.records.push(inv("c", 300, InvoiceStatus::Overdue, 60, 90));
        assert_eq!(l.overdue_count(), 2);
    }

    #[test]
    fn distribution_amount_weighted() {
        let mut l = InvoiceLedger::new();
        // Big invoice with slow settlement dominates.
        l.records.push(inv("big", 10_000, InvoiceStatus::Open, 60, 120));
        l.records.push(inv("small", 100, InvoiceStatus::Open, 7, 14));
        let d = l.settlement_distribution();
        assert!(d.p50_days > 50);
        assert!(d.p90_days > 100);
    }

    #[test]
    fn empty_ledger_yields_zero_distribution() {
        let l = InvoiceLedger::new();
        let d = l.settlement_distribution();
        assert_eq!(d, SettlementDistribution::default());
    }

    #[test]
    fn paid_and_uncollectable_excluded_from_open() {
        let mut l = InvoiceLedger::new();
        l.records.push(inv("a", 1_000, InvoiceStatus::Paid, 0, 0));
        l.records.push(inv("b", 2_000, InvoiceStatus::Uncollectable, 0, 0));
        assert_eq!(l.open_balance_q64(), 0);
    }
}

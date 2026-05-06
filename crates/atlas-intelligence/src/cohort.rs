//! Smart-money cohort registry (directive §3 + §14 4-cohort minimum).

pub use crate::source::DuneQueryId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SmartCohort {
    pub label: SmartMoneyLabel,
    pub query_id: DuneQueryId,
    pub description: &'static str,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SmartMoneyLabel {
    /// Top 200 stablecoin holders, refreshed daily.
    TopStablecoinHolders,
    /// Top 100 yield rotators by 90 d activity.
    YieldRotators90d,
    /// DAO and protocol treasury wallets (Squads multisig + similar).
    DaoTreasuries,
    /// Cross-chain stablecoin movers: wallets observed shifting >
    /// $50k across Solana ↔ EVM in the trailing 30 d.
    CrossChainStableMovers,
}

/// Directive §14 demands ≥ 4 named cohorts.
pub const COHORTS_MIN_REQUIRED: usize = 4;

pub const fn cohort_registry() -> &'static [SmartCohort] {
    &[
        SmartCohort {
            label: SmartMoneyLabel::TopStablecoinHolders,
            query_id: DuneQueryId(8_100_001),
            description: "Top 200 stablecoin holders, refreshed daily",
        },
        SmartCohort {
            label: SmartMoneyLabel::YieldRotators90d,
            query_id: DuneQueryId(8_100_002),
            description: "Top 100 yield rotators by 90d activity",
        },
        SmartCohort {
            label: SmartMoneyLabel::DaoTreasuries,
            query_id: DuneQueryId(8_100_003),
            description: "DAO + protocol treasury wallets (Squads + similar)",
        },
        SmartCohort {
            label: SmartMoneyLabel::CrossChainStableMovers,
            query_id: DuneQueryId(8_100_004),
            description: "Wallets shifting > $50k across Solana ↔ EVM in 30d",
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_has_at_least_minimum_required_cohorts() {
        assert!(cohort_registry().len() >= COHORTS_MIN_REQUIRED);
    }

    #[test]
    fn cohort_labels_are_unique() {
        let mut labels: Vec<SmartMoneyLabel> = cohort_registry().iter().map(|c| c.label).collect();
        let total = labels.len();
        labels.sort_by_key(|l| format!("{:?}", l));
        labels.dedup();
        assert_eq!(labels.len(), total);
    }

    #[test]
    fn cohort_query_ids_are_unique() {
        let mut ids: Vec<u32> = cohort_registry().iter().map(|c| c.query_id.0).collect();
        let total = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), total);
    }
}

//! atlas-intelligence — onchain intelligence engine (directive 11).
//!
//! **Hard rule (directive §0):** Dune SIM output never enters a
//! Poseidon commitment path. This crate is monitoring, pre-deposit
//! UX, post-trade analytics, and cross-chain enrichment ONLY. The
//! Phase 09 commitment-path lint (extended in
//! `atlas_runtime::lints::forbid_third_party_in_commitment`) refuses
//! any reference to `DuneSimSource` / `DuneQueryId` /
//! `WalletIntelligenceReport` / `CapitalFlowHeatmap` from
//! commitment-path source files.
//!
//! Eight modules:
//!
//! * `source`         — `IntelligenceSource` trait + concrete
//!                      `DuneSimSource` and `AtlasWarehouseSource`
//!                      with snapshot-tagged result store.
//! * `wallet_report`  — `WalletIntelligenceReport` schema +
//!                      deterministic recommendation scorer (§2).
//! * `cohort`         — Smart cohort registry (§3) — at least four
//!                      named cohorts.
//! * `cross_chain`    — Treasury cross-chain mirror with provenance
//!                      per leg (§4).
//! * `heatmap`        — Capital flow heatmap (§5.1).
//! * `exposure_graph` — Wallet → Protocol → Asset graph (§5.2).
//! * `multi_wallet`   — Multi-wallet aggregation under
//!                      `TreasuryEntity` (§7).
//! * `backtest`       — `BacktestDataProvenance` flagging
//!                      `DuneAugmented` mode separately from
//!                      `FullReplay` (§9).

#![deny(unsafe_code)]
#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

pub mod backtest;
pub mod cohort;
pub mod cross_chain;
pub mod exposure_graph;
pub mod heatmap;
pub mod multi_wallet;
pub mod source;
pub mod wallet_report;

pub use backtest::{BacktestDataProvenance, DeterminismClass};
pub use cohort::{
    cohort_registry, DuneQueryId, SmartCohort, SmartMoneyLabel, COHORTS_MIN_REQUIRED,
};
pub use cross_chain::{
    aggregate_cross_chain_nav, ChainLeg, CombinedNav, CombinedNavError, NavProvenance,
};
pub use exposure_graph::{build_exposure_graph, ExposureEdge, ExposureGraph, ExposureNode};
pub use heatmap::{
    build_capital_flow_heatmap, CapitalFlowHeatmap, FlowCell, FlowDirection, HeatmapSourceTag,
};
pub use multi_wallet::{aggregate_multi_wallet, MultiWalletAggregate};
pub use source::{
    AtlasWarehouseSource, DuneSimSource, IntelligenceSource, QuerySnapshot, SnapshotError,
    SnapshotStore,
};
pub use wallet_report::{
    score_wallet, AssetBucket, BehaviorMetrics, ExposureSummary, RecommendationKind,
    WalletIntelligenceReport, WalletRecommendation,
};

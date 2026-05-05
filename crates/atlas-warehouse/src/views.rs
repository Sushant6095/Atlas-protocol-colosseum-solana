//! Materialized view names (directive §4).
//!
//! Views are defined in SQL under `db/clickhouse/V*.sql`. This module exposes
//! the view names as constants so analyst code does not stringify them
//! ad-hoc.

pub const MV_REBALANCE_SUMMARY_DAILY: &str = "mv_rebalance_summary_daily";
pub const MV_AGENT_DISAGREEMENT_DISTRIBUTION: &str = "mv_agent_disagreement_distribution";
pub const MV_FAILURE_CLASS_RATE: &str = "mv_failure_class_rate";
pub const MV_PROTOCOL_EXPOSURE_OVER_TIME: &str = "mv_protocol_exposure_over_time";

pub const ALL_VIEWS: &[&str] = &[
    MV_REBALANCE_SUMMARY_DAILY,
    MV_AGENT_DISAGREEMENT_DISTRIBUTION,
    MV_FAILURE_CLASS_RATE,
    MV_PROTOCOL_EXPOSURE_OVER_TIME,
];

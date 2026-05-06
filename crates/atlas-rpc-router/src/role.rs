//! Tier-A / Tier-B / Tier-C role assignment (directive §1.1).
//!
//! Sources are tagged at adapter registration. A source can carry
//! more than one role tag if it meets the cross-tier requirements;
//! default is single-tag for clarity. RPC Fast joins as
//! `tier_a_latency` only.

use atlas_bus::SourceId;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RpcRole {
    /// Hot-path reads where staleness > 1 slot is a bug. p99 ≤ 250ms;
    /// best-effort consistency. Never counted in quorum minimums by
    /// default (see `RpcRoleSet::counts_in_quorum`).
    TierALatency,
    /// Commitment-bound reads. Cross-validated against peers. p99 ≤
    /// 800ms; quorum-required.
    TierBQuorum,
    /// Replay, backfill, deep-history queries. p99 ≤ 5s;
    /// snapshot-versioned.
    TierCArchive,
}

impl RpcRole {
    pub fn name(self) -> &'static str {
        match self {
            RpcRole::TierALatency => "tier_a_latency",
            RpcRole::TierBQuorum => "tier_b_quorum",
            RpcRole::TierCArchive => "tier_c_archive",
        }
    }

    /// p99 latency budget (ms) for this role per directive §1.1.
    pub fn p99_latency_budget_ms(self) -> u32 {
        match self {
            RpcRole::TierALatency => 250,
            RpcRole::TierBQuorum => 800,
            RpcRole::TierCArchive => 5_000,
        }
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RpcRoleSetError {
    #[error("source must carry at least one role")]
    Empty,
    #[error(
        "tier_a_latency + tier_b_quorum requires geographic infra diversity \
         (Phase 02 §3 guard); set `geographic_diversity_attested = true` to allow"
    )]
    DualRoleWithoutDiversity,
}

/// The set of role tags assigned to a single source. Construction
/// enforces directive anti-pattern §9 #1: counting a tier-A latency
/// vendor toward commitment quorum without geographic diversity
/// attestation.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RpcRoleSet {
    roles: BTreeSet<RpcRole>,
    geographic_diversity_attested: bool,
}

impl RpcRoleSet {
    pub fn single(role: RpcRole) -> Self {
        let mut roles = BTreeSet::new();
        roles.insert(role);
        Self { roles, geographic_diversity_attested: false }
    }

    pub fn from_roles(
        roles: impl IntoIterator<Item = RpcRole>,
        geographic_diversity_attested: bool,
    ) -> Result<Self, RpcRoleSetError> {
        let roles: BTreeSet<RpcRole> = roles.into_iter().collect();
        if roles.is_empty() {
            return Err(RpcRoleSetError::Empty);
        }
        if roles.contains(&RpcRole::TierALatency)
            && roles.contains(&RpcRole::TierBQuorum)
            && !geographic_diversity_attested
        {
            return Err(RpcRoleSetError::DualRoleWithoutDiversity);
        }
        Ok(Self { roles, geographic_diversity_attested })
    }

    pub fn carries(&self, role: RpcRole) -> bool {
        self.roles.contains(&role)
    }

    pub fn iter(&self) -> impl Iterator<Item = RpcRole> + '_ {
        self.roles.iter().copied()
    }

    /// True iff the source counts toward the `min_sources` quorum
    /// minimum (Phase 02 §3). Tier-A-only sources never count;
    /// dual-role sources count only when geographic diversity has
    /// been attested.
    pub fn counts_in_quorum(&self) -> bool {
        self.roles.contains(&RpcRole::TierBQuorum)
    }

    pub fn geographic_diversity_attested(&self) -> bool {
        self.geographic_diversity_attested
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoleAssignment {
    pub source: SourceId,
    pub role_set: RpcRoleSet,
    pub region_tag: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct SourceManifest {
    pub assignments: Vec<RoleAssignment>,
}

impl SourceManifest {
    pub fn new() -> Self { Self::default() }

    pub fn assign(
        mut self,
        source: SourceId,
        role_set: RpcRoleSet,
        region_tag: impl Into<String>,
    ) -> Self {
        self.assignments.push(RoleAssignment {
            source,
            role_set,
            region_tag: region_tag.into(),
        });
        self
    }

    pub fn role_set_for(&self, source: SourceId) -> Option<&RpcRoleSet> {
        self.assignments.iter().find(|a| a.source == source).map(|a| &a.role_set)
    }

    pub fn sources_in_role(&self, role: RpcRole) -> Vec<SourceId> {
        self.assignments
            .iter()
            .filter(|a| a.role_set.carries(role))
            .map(|a| a.source)
            .collect()
    }

    /// Sources eligible for the commitment-bound quorum (those that
    /// either carry only `tier_b_quorum`, or carry both `tier_b` and
    /// `tier_a` with a geographic-diversity attestation).
    pub fn quorum_eligible(&self) -> Vec<SourceId> {
        self.assignments
            .iter()
            .filter(|a| a.role_set.counts_in_quorum())
            .map(|a| a.source)
            .collect()
    }
}

/// Default role mapping per directive §1.1 + §1.3. Real deployment
/// reads role tags from config; this function is the canonical
/// fallback so tests + dashboards can render without a config file.
pub fn canonical_role_for(source: SourceId) -> RpcRoleSet {
    match source {
        // Quorum partners — Phase 02 §1.
        SourceId::YellowstoneTriton
        | SourceId::YellowstoneHelius
        | SourceId::YellowstoneQuickNode => RpcRoleSet::single(RpcRole::TierBQuorum),
        // Phase 17 — RPC Fast registered as tier-A only by default.
        SourceId::RpcFast => RpcRoleSet::single(RpcRole::TierALatency),
        // WSS / webhook / archival sources.
        SourceId::HeliusWebSocket
        | SourceId::HeliusWebhook
        | SourceId::JitoBlockEngine => RpcRoleSet::single(RpcRole::TierBQuorum),
        // Oracles.
        SourceId::PythHermes
        | SourceId::SwitchboardOnDemand => RpcRoleSet::single(RpcRole::TierBQuorum),
        // Ranking / overlay / DEX-pool data — archival reads.
        SourceId::Birdeye
        | SourceId::DefiLlama
        | SourceId::Jupiter
        | SourceId::Meteora
        | SourceId::Orca
        | SourceId::Raydium => RpcRoleSet::single(RpcRole::TierCArchive),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tier_a_only_source_does_not_count_in_quorum() {
        let s = RpcRoleSet::single(RpcRole::TierALatency);
        assert!(!s.counts_in_quorum());
    }

    #[test]
    fn tier_b_only_source_counts_in_quorum() {
        let s = RpcRoleSet::single(RpcRole::TierBQuorum);
        assert!(s.counts_in_quorum());
    }

    #[test]
    fn dual_role_without_diversity_rejected() {
        let r = RpcRoleSet::from_roles(
            [RpcRole::TierALatency, RpcRole::TierBQuorum],
            false,
        );
        assert!(matches!(r, Err(RpcRoleSetError::DualRoleWithoutDiversity)));
    }

    #[test]
    fn dual_role_with_diversity_accepted() {
        let r = RpcRoleSet::from_roles(
            [RpcRole::TierALatency, RpcRole::TierBQuorum],
            true,
        )
        .unwrap();
        assert!(r.counts_in_quorum());
        assert!(r.carries(RpcRole::TierALatency));
        assert!(r.geographic_diversity_attested());
    }

    #[test]
    fn empty_role_set_rejected() {
        let r = RpcRoleSet::from_roles([], false);
        assert!(matches!(r, Err(RpcRoleSetError::Empty)));
    }

    #[test]
    fn rpc_fast_canonical_is_tier_a_only() {
        let s = canonical_role_for(SourceId::RpcFast);
        assert!(s.carries(RpcRole::TierALatency));
        assert!(!s.counts_in_quorum());
    }

    #[test]
    fn yellowstone_partners_are_tier_b() {
        for src in [
            SourceId::YellowstoneTriton,
            SourceId::YellowstoneHelius,
            SourceId::YellowstoneQuickNode,
        ] {
            let s = canonical_role_for(src);
            assert!(s.counts_in_quorum(), "{:?} should count in quorum", src);
        }
    }

    #[test]
    fn manifest_filters_quorum_eligible() {
        let m = SourceManifest::new()
            .assign(
                SourceId::YellowstoneTriton,
                canonical_role_for(SourceId::YellowstoneTriton),
                "iad",
            )
            .assign(
                SourceId::RpcFast,
                canonical_role_for(SourceId::RpcFast),
                "fra",
            );
        let q = m.quorum_eligible();
        assert_eq!(q, vec![SourceId::YellowstoneTriton]);
    }

    #[test]
    fn p99_budgets_match_directive() {
        assert_eq!(RpcRole::TierALatency.p99_latency_budget_ms(), 250);
        assert_eq!(RpcRole::TierBQuorum.p99_latency_budget_ms(), 800);
        assert_eq!(RpcRole::TierCArchive.p99_latency_budget_ms(), 5_000);
    }

    #[test]
    fn manifest_lookup_by_role() {
        let m = SourceManifest::new()
            .assign(
                SourceId::RpcFast,
                canonical_role_for(SourceId::RpcFast),
                "fra",
            )
            .assign(
                SourceId::YellowstoneTriton,
                canonical_role_for(SourceId::YellowstoneTriton),
                "iad",
            );
        let tier_a = m.sources_in_role(RpcRole::TierALatency);
        assert_eq!(tier_a, vec![SourceId::RpcFast]);
        let tier_b = m.sources_in_role(RpcRole::TierBQuorum);
        assert_eq!(tier_b, vec![SourceId::YellowstoneTriton]);
    }
}

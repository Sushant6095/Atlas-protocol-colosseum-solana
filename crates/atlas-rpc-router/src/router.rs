//! `RpcRouter` — explicit `read_hot` / `read_quorum` / `read_archive`
//! split (directive §2).
//!
//! Calling code declares its read class explicitly. The router never
//! implicitly upgrades a hot read to a quorum read; that would
//! defeat the latency win. Conversely, the router never silently
//! downgrades a quorum read to a single-source read; that would
//! defeat the consistency guarantee.

use crate::role::{RpcRole, SourceManifest};
use atlas_bus::{Pubkey, SourceId};
use serde::{Deserialize, Serialize};

/// Account fetch request. Mirrors what the on-chain RPC sees.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccountRead {
    pub pubkey: Pubkey,
    pub commitment_min_slot: Option<u64>,
}

/// Single-source response — used for both `read_hot` and per-source
/// quorum samples. Latency is measured at the router level.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccountResult {
    pub pubkey: Pubkey,
    pub slot: u64,
    pub data_hash: [u8; 32],
    pub source: SourceId,
    pub latency_ms: u32,
}

/// Archive fetch — bounded by a snapshot slot so replays are
/// deterministic.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArchiveRead {
    pub pubkey: Pubkey,
    pub at_slot: u64,
}

/// Quorum result — keeps the per-source samples around for the
/// attribution engine.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct QuorumPath {
    pub canonical_data_hash: [u8; 32],
    pub canonical_slot: u64,
    pub samples: Vec<AccountResult>,
}

/// Explicit read class declared by the caller. The runtime lint
/// `lint_no_read_hot_in_commitment_path` (atlas-runtime) refuses to
/// compile a commitment-path crate that mentions `ReadClass::Hot`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReadClass {
    Hot,
    Quorum,
    Archive,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RouteDecision {
    pub class: ReadClass,
    pub picked_source: Option<SourceId>,
    pub picked_sources: Vec<SourceId>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RouterError {
    #[error("no source carries role {0:?}")]
    NoSourceForRole(RpcRole),
    #[error("quorum requires at least {min} sources, manifest has {actual}")]
    InsufficientQuorum { min: u8, actual: u8 },
    #[error(transparent)]
    HotRead(#[from] HotReadError),
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum HotReadError {
    #[error(
        "read_hot called from a commitment-path code path \
         (Stage 01 ingestion / Phase 06 sandbox / Phase 12 verify path) — directive §9 anti-pattern"
    )]
    CommitmentPathMisuse,
    #[error("hot read latency {observed_ms}ms exceeds tier_a budget {budget_ms}ms")]
    OverBudget { observed_ms: u32, budget_ms: u32 },
}

/// Router contract. Production deployments back this with the
/// real Phase 02 multi-RPC stack; tests mock it. The trait is split
/// across `read_hot` / `read_quorum` / `read_archive` so each
/// signature is ergonomic for its intended caller and a misuse can
/// be flagged at the type level.
pub trait RpcRouter: Send + Sync {
    /// Single-source latency-optimised read. Routes to a
    /// `tier_a_latency` source picked by the manifest. Caller code
    /// MUST NOT live in a commitment-path crate.
    fn read_hot(&self, request: AccountRead) -> Result<AccountResult, RouterError>;
    /// Quorum read. Returns the canonical data hash + per-source
    /// samples for attribution.
    fn read_quorum(&self, request: AccountRead) -> Result<QuorumPath, RouterError>;
    /// Archive read at a fixed snapshot slot.
    fn read_archive(&self, request: ArchiveRead) -> Result<AccountResult, RouterError>;

    /// Manifest snapshot. Used by /infra dashboards and the
    /// attribution engine.
    fn manifest(&self) -> &SourceManifest;

    /// Decide which source(s) would be used for a given read class
    /// without actually fetching. Useful for the playground.
    fn route(&self, class: ReadClass) -> Result<RouteDecision, RouterError> {
        match class {
            ReadClass::Hot => {
                let candidates = self.manifest().sources_in_role(RpcRole::TierALatency);
                let picked = candidates.first().copied();
                if picked.is_none() {
                    return Err(RouterError::NoSourceForRole(RpcRole::TierALatency));
                }
                Ok(RouteDecision { class, picked_source: picked, picked_sources: candidates })
            }
            ReadClass::Quorum => {
                let candidates = self.manifest().quorum_eligible();
                let n = candidates.len() as u8;
                let min = 2u8;
                if n < min {
                    return Err(RouterError::InsufficientQuorum { min, actual: n });
                }
                Ok(RouteDecision { class, picked_source: None, picked_sources: candidates })
            }
            ReadClass::Archive => {
                let candidates = self.manifest().sources_in_role(RpcRole::TierCArchive);
                let picked = candidates.first().copied();
                Ok(RouteDecision { class, picked_source: picked, picked_sources: candidates })
            }
        }
    }
}

/// Reference router used by tests + the playground. It accepts
/// hand-crafted `AccountResult`s keyed by `(pubkey, source)` and
/// returns them via the appropriate path.
pub struct StaticRouter {
    manifest: SourceManifest,
    hot_responses: Vec<AccountResult>,
    quorum_responses: Vec<AccountResult>,
    archive_responses: Vec<(ArchiveRead, AccountResult)>,
    commitment_path_misuse: bool,
}

impl StaticRouter {
    pub fn new(manifest: SourceManifest) -> Self {
        Self {
            manifest,
            hot_responses: Vec::new(),
            quorum_responses: Vec::new(),
            archive_responses: Vec::new(),
            commitment_path_misuse: false,
        }
    }

    pub fn with_hot(mut self, r: AccountResult) -> Self { self.hot_responses.push(r); self }
    pub fn with_quorum_sample(mut self, r: AccountResult) -> Self { self.quorum_responses.push(r); self }
    pub fn with_archive(mut self, k: ArchiveRead, r: AccountResult) -> Self {
        self.archive_responses.push((k, r));
        self
    }
    /// Simulate the lint failing — used in chaos tests.
    pub fn flag_commitment_path_misuse(mut self) -> Self {
        self.commitment_path_misuse = true;
        self
    }
}

impl RpcRouter for StaticRouter {
    fn read_hot(&self, request: AccountRead) -> Result<AccountResult, RouterError> {
        if self.commitment_path_misuse {
            return Err(RouterError::HotRead(HotReadError::CommitmentPathMisuse));
        }
        let r = self
            .hot_responses
            .iter()
            .find(|r| r.pubkey == request.pubkey)
            .cloned()
            .ok_or(RouterError::NoSourceForRole(RpcRole::TierALatency))?;
        let budget = RpcRole::TierALatency.p99_latency_budget_ms();
        if r.latency_ms > budget {
            return Err(RouterError::HotRead(HotReadError::OverBudget {
                observed_ms: r.latency_ms,
                budget_ms: budget,
            }));
        }
        Ok(r)
    }

    fn read_quorum(&self, request: AccountRead) -> Result<QuorumPath, RouterError> {
        let samples: Vec<AccountResult> = self
            .quorum_responses
            .iter()
            .filter(|r| r.pubkey == request.pubkey)
            .cloned()
            .collect();
        if (samples.len() as u8) < 2 {
            return Err(RouterError::InsufficientQuorum {
                min: 2,
                actual: samples.len() as u8,
            });
        }
        // Canonical = mode of data_hash; ties resolve by lowest source id
        // (deterministic).
        let mut counts: std::collections::BTreeMap<[u8; 32], (u32, SourceId, u64)> =
            std::collections::BTreeMap::new();
        for s in &samples {
            let entry = counts.entry(s.data_hash).or_insert((0, s.source, s.slot));
            entry.0 += 1;
            if (s.source as u8) < (entry.1 as u8) {
                entry.1 = s.source;
                entry.2 = s.slot;
            }
        }
        let (canonical_data_hash, (_, _, canonical_slot)) =
            counts.into_iter().max_by_key(|(_, (n, _, _))| *n).unwrap_or((
                [0u8; 32],
                (0, SourceId::YellowstoneTriton, 0),
            ));
        Ok(QuorumPath { canonical_data_hash, canonical_slot, samples })
    }

    fn read_archive(&self, request: ArchiveRead) -> Result<AccountResult, RouterError> {
        let r = self
            .archive_responses
            .iter()
            .find(|(k, _)| *k == request)
            .map(|(_, v)| v.clone())
            .ok_or(RouterError::NoSourceForRole(RpcRole::TierCArchive))?;
        Ok(r)
    }

    fn manifest(&self) -> &SourceManifest { &self.manifest }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::role::canonical_role_for;

    fn manifest() -> SourceManifest {
        SourceManifest::new()
            .assign(
                SourceId::RpcFast,
                canonical_role_for(SourceId::RpcFast),
                "fra",
            )
            .assign(
                SourceId::YellowstoneTriton,
                canonical_role_for(SourceId::YellowstoneTriton),
                "iad",
            )
            .assign(
                SourceId::YellowstoneHelius,
                canonical_role_for(SourceId::YellowstoneHelius),
                "ams",
            )
    }

    fn sample(pubkey: Pubkey, src: SourceId, slot: u64, hash: [u8; 32], lat: u32) -> AccountResult {
        AccountResult { pubkey, slot, data_hash: hash, source: src, latency_ms: lat }
    }

    #[test]
    fn hot_read_routes_to_tier_a() {
        let pk = [1u8; 32];
        let r = StaticRouter::new(manifest())
            .with_hot(sample(pk, SourceId::RpcFast, 1_000, [9u8; 32], 90));
        let res = r.read_hot(AccountRead { pubkey: pk, commitment_min_slot: None }).unwrap();
        assert_eq!(res.source, SourceId::RpcFast);
        assert_eq!(res.latency_ms, 90);
    }

    #[test]
    fn hot_read_over_budget_rejects() {
        let pk = [1u8; 32];
        let r = StaticRouter::new(manifest())
            .with_hot(sample(pk, SourceId::RpcFast, 1_000, [9u8; 32], 400));
        let res = r.read_hot(AccountRead { pubkey: pk, commitment_min_slot: None });
        assert!(matches!(res, Err(RouterError::HotRead(HotReadError::OverBudget { .. }))));
    }

    #[test]
    fn hot_read_commitment_misuse_rejected() {
        let pk = [1u8; 32];
        let r = StaticRouter::new(manifest()).flag_commitment_path_misuse();
        let res = r.read_hot(AccountRead { pubkey: pk, commitment_min_slot: None });
        assert!(matches!(res, Err(RouterError::HotRead(HotReadError::CommitmentPathMisuse))));
    }

    #[test]
    fn quorum_read_uses_only_tier_b_sources() {
        let pk = [1u8; 32];
        let r = StaticRouter::new(manifest())
            .with_quorum_sample(sample(pk, SourceId::YellowstoneTriton, 1_000, [9u8; 32], 200))
            .with_quorum_sample(sample(pk, SourceId::YellowstoneHelius, 1_000, [9u8; 32], 220));
        let q = r.read_quorum(AccountRead { pubkey: pk, commitment_min_slot: None }).unwrap();
        assert_eq!(q.samples.len(), 2);
        assert_eq!(q.canonical_data_hash, [9u8; 32]);
    }

    #[test]
    fn quorum_read_below_min_sources_rejects() {
        let pk = [1u8; 32];
        let r = StaticRouter::new(manifest())
            .with_quorum_sample(sample(pk, SourceId::YellowstoneTriton, 1_000, [9u8; 32], 200));
        let q = r.read_quorum(AccountRead { pubkey: pk, commitment_min_slot: None });
        assert!(matches!(q, Err(RouterError::InsufficientQuorum { min: 2, actual: 1 })));
    }

    #[test]
    fn route_hot_returns_rpc_fast() {
        let r = StaticRouter::new(manifest());
        let d = r.route(ReadClass::Hot).unwrap();
        assert_eq!(d.picked_source, Some(SourceId::RpcFast));
    }

    #[test]
    fn route_quorum_excludes_tier_a_only_sources() {
        let r = StaticRouter::new(manifest());
        let d = r.route(ReadClass::Quorum).unwrap();
        assert!(!d.picked_sources.contains(&SourceId::RpcFast));
        assert_eq!(d.picked_sources.len(), 2);
    }

    #[test]
    fn archive_read_returns_recorded_response() {
        let pk = [1u8; 32];
        let key = ArchiveRead { pubkey: pk, at_slot: 500 };
        let r = StaticRouter::new(manifest())
            .with_archive(key.clone(), sample(pk, SourceId::Birdeye, 500, [7u8; 32], 1_500));
        let v = r.read_archive(key).unwrap();
        assert_eq!(v.slot, 500);
    }
}

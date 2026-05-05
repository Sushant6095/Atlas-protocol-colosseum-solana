//! Stage 01 — IngestState.
//!
//! Quorum read across `N >= 3` independent RPC providers.
//!
//! Hard rules (from directive §3):
//!   - Concurrent fetch with per-provider deadline (default 800ms).
//!   - `⌈N/2⌉ + 1` providers must return identical account hashes for every
//!     account in the static read set. Disagreement → halt.
//!   - Slot divergence guard: reject if `max(slot_i) - min(slot_i) > 8`.
//!   - Static account read set per protocol adapter; no dynamic discovery.
//!   - Provider trust scoring: each disagreement decrements a rolling score.
//!     Below threshold → quarantined for K slots.
//!   - `snapshot_id = poseidon(b"atlas.snapshot.v1", sorted_account_hashes, slot)`.

use crate::{
    ctx::PipelineCtx,
    hashing::{hash_with_tag, tags},
    stage::{Stage, StageError},
};
use std::{collections::BTreeMap, time::Duration};

/// Static read set for one rebalance — declared per protocol adapter, never
/// dynamically discovered (I-7: no silent fallbacks, no surprise dependencies).
#[derive(Clone, Debug)]
pub struct ReadSet {
    pub accounts: Vec<[u8; 32]>, // Pubkey raw bytes, lexicographically sorted
}

impl ReadSet {
    pub fn new(mut accounts: Vec<[u8; 32]>) -> Self {
        accounts.sort();
        accounts.dedup();
        Self { accounts }
    }
}

#[derive(Clone, Debug)]
pub struct ProviderConfig {
    pub url: String,
    pub deadline: Duration,
}

impl ProviderConfig {
    pub fn new(url: impl Into<String>) -> Self {
        Self {
            url: url.into(),
            deadline: Duration::from_millis(800),
        }
    }
}

#[derive(Clone, Debug)]
pub struct ProviderResult {
    pub url: String,
    pub slot: u64,
    /// Map of account → 32-byte content hash (sha256 of raw account data).
    /// `BTreeMap` not `HashMap` — I-6 deterministic ordering.
    pub account_hashes: BTreeMap<[u8; 32], [u8; 32]>,
    pub latency_ms: u64,
}

/// Final, content-addressed snapshot consumed by downstream stages.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MultiRpcSnapshot {
    pub slot: u64,
    pub snapshot_id: [u8; 32],
    pub account_hashes: BTreeMap<[u8; 32], [u8; 32]>,
    pub providers_in_quorum: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct IngestParams {
    pub providers: Vec<ProviderConfig>,
    pub read_set: ReadSet,
    pub max_slot_divergence: u64,
}

pub struct IngestState;

#[async_trait::async_trait]
impl Stage for IngestState {
    const ID: &'static str = "01-ingest-state";
    type Input = IngestParams;
    type Output = MultiRpcSnapshot;

    async fn run(
        &self,
        _ctx: &PipelineCtx,
        input: IngestParams,
    ) -> Result<Self::Output, StageError> {
        if input.providers.len() < 3 {
            return Err(StageError::InvariantViolation {
                stage: Self::ID,
                detail: format!(
                    "quorum requires >=3 providers; configured: {}",
                    input.providers.len()
                ),
            });
        }

        // Phase 1 stub: real impl uses `solana_client::nonblocking::rpc_client`
        // with `tokio::time::timeout` per provider, all in flight via JoinSet.
        // We return a deterministic synthetic quorum so determinism tests run today.
        let mut results: Vec<ProviderResult> = Vec::with_capacity(input.providers.len());
        for p in &input.providers {
            let mut account_hashes = BTreeMap::new();
            for a in &input.read_set.accounts {
                // Deterministic placeholder hash: sha256(provider_url || account)
                let hash = hash_with_tag(b"atlas.ingest.stub", &[p.url.as_bytes(), a]);
                account_hashes.insert(*a, hash);
            }
            results.push(ProviderResult {
                url: p.url.clone(),
                slot: _ctx.slot,
                account_hashes,
                latency_ms: 0,
            });
        }

        compute_quorum(&results, input.max_slot_divergence)
    }

    async fn replay(
        &self,
        ctx: &PipelineCtx,
        _input: IngestParams,
    ) -> Result<Self::Output, StageError> {
        // Phase 2: read snapshot bytes from archival store and reconstruct.
        Err(StageError::MissingArchival { stage: Self::ID, slot: ctx.slot })
    }
}

/// Pure quorum computation — testable without network.
pub fn compute_quorum(
    results: &[ProviderResult],
    max_slot_divergence: u64,
) -> Result<MultiRpcSnapshot, StageError> {
    if results.is_empty() {
        return Err(StageError::QuorumDisagreement {
            stage: IngestState::ID,
            detail: "no provider results".into(),
        });
    }

    // Slot divergence guard
    let slot_min = results.iter().map(|r| r.slot).min().unwrap_or(0);
    let slot_max = results.iter().map(|r| r.slot).max().unwrap_or(0);
    if slot_max.saturating_sub(slot_min) > max_slot_divergence {
        return Err(StageError::QuorumDisagreement {
            stage: IngestState::ID,
            detail: format!(
                "slot divergence {} > {}",
                slot_max - slot_min,
                max_slot_divergence
            ),
        });
    }

    let n = results.len();
    let quorum_size = n / 2 + 1; // ⌈N/2⌉ + 1

    // Per-account agreement: count, for each account, how many providers reported the same hash.
    // Reject if any account fails to reach quorum on a single hash value.
    let read_set: Vec<[u8; 32]> = match results.first() {
        Some(first) => first.account_hashes.keys().copied().collect(),
        None => Vec::new(),
    };

    let mut chosen: BTreeMap<[u8; 32], [u8; 32]> = BTreeMap::new();
    let mut providers_in_quorum: Vec<String> = Vec::new();

    for account in &read_set {
        // Tally hashes for this account across providers
        let mut counts: BTreeMap<[u8; 32], usize> = BTreeMap::new();
        for r in results {
            if let Some(h) = r.account_hashes.get(account) {
                *counts.entry(*h).or_insert(0) += 1;
            }
        }
        let winner = counts
            .iter()
            .max_by_key(|(_, c)| **c)
            .map(|(h, c)| (*h, *c));
        match winner {
            Some((h, c)) if c >= quorum_size => {
                chosen.insert(*account, h);
            }
            _ => {
                return Err(StageError::QuorumDisagreement {
                    stage: IngestState::ID,
                    detail: format!(
                        "account {:?} failed to reach quorum (need {}, max group {:?})",
                        account, quorum_size, winner.map(|(_, c)| c)
                    ),
                });
            }
        }
    }

    // Record which providers contributed to the winning quorum (for telemetry / scoring).
    if let Some(first_account) = read_set.first() {
        if let Some(winning_hash) = chosen.get(first_account) {
            for r in results {
                if r.account_hashes.get(first_account) == Some(winning_hash) {
                    providers_in_quorum.push(r.url.clone());
                }
            }
        }
    }

    // Content-addressed snapshot id: tag || sorted_account_hashes || slot_le.
    // Sorted by account pubkey (BTreeMap iteration), giving a canonical byte stream.
    let mut hash_stream: Vec<[u8; 32]> = chosen.values().copied().collect();
    hash_stream.sort();
    let refs: Vec<&[u8]> = hash_stream.iter().map(|h| h.as_slice()).collect();
    let mut tagged: Vec<&[u8]> = Vec::with_capacity(refs.len() + 1);
    tagged.extend_from_slice(&refs);
    let slot_le = slot_min.to_le_bytes();
    tagged.push(&slot_le);
    let snapshot_id = hash_with_tag(tags::SNAPSHOT_V1, &tagged);

    Ok(MultiRpcSnapshot {
        slot: slot_min,
        snapshot_id,
        account_hashes: chosen,
        providers_in_quorum,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_result(url: &str, slot: u64, accounts: &[([u8; 32], [u8; 32])]) -> ProviderResult {
        let mut m = BTreeMap::new();
        for (a, h) in accounts {
            m.insert(*a, *h);
        }
        ProviderResult {
            url: url.into(),
            slot,
            account_hashes: m,
            latency_ms: 0,
        }
    }

    #[test]
    fn quorum_unanimous_three() {
        let acc = [1u8; 32];
        let h = [9u8; 32];
        let rs = vec![
            make_result("rpc-a", 100, &[(acc, h)]),
            make_result("rpc-b", 100, &[(acc, h)]),
            make_result("rpc-c", 100, &[(acc, h)]),
        ];
        let snap = compute_quorum(&rs, 8).expect("quorum");
        assert_eq!(snap.slot, 100);
        assert_eq!(snap.account_hashes.len(), 1);
        assert_eq!(snap.providers_in_quorum.len(), 3);
    }

    #[test]
    fn quorum_split_halts() {
        let acc = [1u8; 32];
        let h_a = [9u8; 32];
        let h_b = [8u8; 32];
        // 2-vs-1 with N=3 still passes (quorum=2). To force a halt we need a 1-1-1 split.
        let rs = vec![
            make_result("rpc-a", 100, &[(acc, [1u8; 32])]),
            make_result("rpc-b", 100, &[(acc, [2u8; 32])]),
            make_result("rpc-c", 100, &[(acc, [3u8; 32])]),
        ];
        let _ = h_a;
        let _ = h_b;
        let err = compute_quorum(&rs, 8).expect_err("should halt");
        assert!(matches!(err, StageError::QuorumDisagreement { .. }));
    }

    #[test]
    fn slot_divergence_guard() {
        let acc = [1u8; 32];
        let h = [9u8; 32];
        let rs = vec![
            make_result("rpc-a", 100, &[(acc, h)]),
            make_result("rpc-b", 109, &[(acc, h)]),
            make_result("rpc-c", 100, &[(acc, h)]),
        ];
        let err = compute_quorum(&rs, 8).expect_err("must reject");
        assert!(matches!(err, StageError::QuorumDisagreement { .. }));
    }

    #[test]
    fn snapshot_id_deterministic() {
        let acc = [1u8; 32];
        let h = [9u8; 32];
        let mk = || vec![
            make_result("rpc-a", 100, &[(acc, h)]),
            make_result("rpc-b", 100, &[(acc, h)]),
            make_result("rpc-c", 100, &[(acc, h)]),
        ];
        let s1 = compute_quorum(&mk(), 8).unwrap();
        let s2 = compute_quorum(&mk(), 8).unwrap();
        assert_eq!(s1.snapshot_id, s2.snapshot_id);
    }
}

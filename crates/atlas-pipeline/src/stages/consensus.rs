//! Stage 06 — ResolveConsensus.
//!
//! Arbitration rules (directive §5):
//!   1. Hard veto from any agent → output the pre-committed defensive vector,
//!      verbatim. No weighted aggregation, no clipping. Byte-equal regardless
//!      of how the other six agents voted.
//!   2. Soft veto contributes `weight × -1` in the weighted vote.
//!   3. Weighted aggregation = `confidence × historical_accuracy_ema`,
//!      with the EMA tracked over the last 200 rebalances.
//!   4. Disagreement metric = `1 − cosine(median_alloc, mean_alloc)` across
//!      the surviving (non-vetoed) proposals. If the metric exceeds
//!      `τ_disagree`, magnitude is clipped toward the current allocation by
//!      `(1 − disagreement)` and `consensus.high_disagreement` is alerted.
//!   5. Consensus root = `poseidon(b"atlas.consensus.v2", sorted_proposal_commits)`.
//!
//! All math is integer fixed-point — no float drift between the off-chain
//! pipeline and the SP1 guest. Cosine similarity uses an integer-sqrt path
//! defined here so the guest can mirror it byte-for-byte.

use crate::{
    hashing::{hash_with_tag, tags},
    stages::agents::{AgentId, AgentProposal, VetoLevel},
};

pub const TAU_DISAGREE_BPS: u32 = 1_500; // 0.15
pub const TAU_DISAGREE_EMERGENCY_BPS: u32 = 3_000; // 0.30
pub const TOTAL_BPS: u32 = 10_000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConsensusOutcome {
    pub final_allocation: Vec<u32>,
    pub disagreement_bps: u32,
    pub defensive_triggered: bool,
    pub triggering_agent: Option<AgentId>,
    pub consensus_root: [u8; 32],
    pub clip_factor_bps: u32,
}

#[derive(Clone, Debug)]
pub struct ConsensusInput<'a> {
    pub proposals: &'a [AgentProposal],
    pub current_allocation: &'a [u32],
    pub defensive_allocation: &'a [u32],
    /// EMA of per-agent historical accuracy in bps (10_000 = perfect).
    pub historical_accuracy_bps: &'a [(AgentId, u32)],
    pub tau_disagree_bps: u32,
}

#[derive(Debug, thiserror::Error)]
pub enum ConsensusError {
    #[error("proposals are empty")]
    NoProposals,
    #[error("allocation length mismatch: expected {expected}, agent {agent:?} sent {got}")]
    AllocationLength { expected: usize, agent: AgentId, got: usize },
    #[error("defensive allocation does not sum to 10_000: got {got}")]
    DefensiveBadSum { got: u64 },
    #[error("agent {agent:?} sent invalid proposal: {detail}")]
    BadProposal { agent: AgentId, detail: &'static str },
}

pub fn resolve_consensus(input: ConsensusInput<'_>) -> Result<ConsensusOutcome, ConsensusError> {
    let n = input.defensive_allocation.len();
    if input.proposals.is_empty() {
        return Err(ConsensusError::NoProposals);
    }
    let def_sum: u64 = input.defensive_allocation.iter().map(|x| *x as u64).sum();
    if def_sum != TOTAL_BPS as u64 {
        return Err(ConsensusError::DefensiveBadSum { got: def_sum });
    }

    // Validate every proposal up front.
    for p in input.proposals {
        p.validate(n).map_err(|d| ConsensusError::BadProposal {
            agent: p.agent_id,
            detail: d,
        })?;
    }

    // Step 1 — hard-veto short-circuit.
    if let Some(veto_agent) = first_hard_veto(input.proposals) {
        let consensus_root = consensus_root_from(input.proposals);
        return Ok(ConsensusOutcome {
            final_allocation: input.defensive_allocation.to_vec(),
            disagreement_bps: 0,
            defensive_triggered: true,
            triggering_agent: Some(veto_agent),
            consensus_root,
            clip_factor_bps: 0,
        });
    }

    // Step 2 — assemble per-proposal weights.
    // weight_i = confidence_i × historical_accuracy_i (in bps²); soft veto → negate.
    let weights: Vec<i64> = input
        .proposals
        .iter()
        .map(|p| {
            let acc = lookup_accuracy(p.agent_id, input.historical_accuracy_bps);
            let mag = p.confidence as i64 * acc as i64;
            match p.veto {
                Some(VetoLevel::Soft) => -mag,
                _ => mag,
            }
        })
        .collect();

    // Step 3 — weighted aggregation per protocol.
    let target = weighted_aggregate(input.proposals, &weights, n);

    // Step 4 — disagreement metric.
    let disagreement_bps = disagreement(input.proposals, n);

    // Step 5 — magnitude clipping toward current_allocation when disagreement > τ.
    let (final_allocation, clip_factor_bps) =
        clip_toward_current(&target, input.current_allocation, disagreement_bps, input.tau_disagree_bps);

    let consensus_root = consensus_root_from(input.proposals);

    Ok(ConsensusOutcome {
        final_allocation,
        disagreement_bps,
        defensive_triggered: false,
        triggering_agent: None,
        consensus_root,
        clip_factor_bps,
    })
}

fn first_hard_veto(props: &[AgentProposal]) -> Option<AgentId> {
    let mut sorted: Vec<&AgentProposal> = props.iter().collect();
    sorted.sort_by_key(|p| p.agent_id as u8);
    sorted
        .iter()
        .find(|p| matches!(p.veto, Some(VetoLevel::Hard)))
        .map(|p| p.agent_id)
}

fn lookup_accuracy(agent: AgentId, accuracy: &[(AgentId, u32)]) -> u32 {
    accuracy.iter().find(|(a, _)| *a == agent).map(|(_, v)| *v).unwrap_or(5_000)
}

/// Aggregate proposals by weight per protocol. `weights` may include
/// negative values (soft veto). Renormalizes to exactly `TOTAL_BPS` via
/// largest-remainder.
fn weighted_aggregate(props: &[AgentProposal], weights: &[i64], n: usize) -> Vec<u32> {
    let abs_total: i128 = weights.iter().map(|w| (*w as i128).abs()).sum();
    if abs_total == 0 {
        // No signal — collapse to uniform.
        return uniform(n);
    }

    // Per-protocol weighted sum in i128 to avoid overflow.
    let mut weighted: Vec<i128> = vec![0i128; n];
    for (p, &w) in props.iter().zip(weights.iter()) {
        for (i, bps) in p.allocation_bps.iter().enumerate() {
            weighted[i] += (*bps as i128) * (w as i128);
        }
    }

    // Floor each component to non-negative bps (a soft-veto-dominant outcome
    // could push the raw aggregate negative; we never emit negative bps).
    let mut quotient: Vec<i128> = weighted
        .iter()
        .map(|x| if *x < 0 { 0 } else { *x / abs_total })
        .collect();

    // Renormalize to exactly TOTAL_BPS via largest-remainder.
    let assigned: i128 = quotient.iter().sum();
    let mut remainder: i128 = TOTAL_BPS as i128 - assigned;
    if remainder > 0 {
        // Distribute leftover bps to the protocols with the largest fractional remainders.
        let mut residuals: Vec<(usize, i128)> = weighted
            .iter()
            .enumerate()
            .map(|(i, w)| (i, if *w < 0 { 0 } else { (*w) - quotient[i] * abs_total }))
            .collect();
        residuals.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        let mut idx = 0usize;
        while remainder > 0 && !residuals.is_empty() {
            quotient[residuals[idx % residuals.len()].0] += 1;
            remainder -= 1;
            idx += 1;
        }
    } else if remainder < 0 {
        // Trim from largest assigned components first.
        let mut order: Vec<usize> = (0..n).collect();
        order.sort_by(|a, b| quotient[*b].cmp(&quotient[*a]));
        let mut over = -remainder;
        let mut i = 0;
        while over > 0 && !order.is_empty() {
            let k = order[i % order.len()];
            if quotient[k] > 0 {
                quotient[k] -= 1;
                over -= 1;
            }
            i += 1;
            if i > 10 * n {
                break;
            }
        }
    }

    quotient.into_iter().map(|q| q.clamp(0, TOTAL_BPS as i128) as u32).collect()
}

fn uniform(n: usize) -> Vec<u32> {
    if n == 0 {
        return Vec::new();
    }
    let base = TOTAL_BPS / n as u32;
    let mut v = vec![base; n];
    let used = base * n as u32;
    let mut leftover = TOTAL_BPS - used;
    let mut i = 0;
    while leftover > 0 {
        v[i % n] += 1;
        leftover -= 1;
        i += 1;
    }
    v
}

/// Compute disagreement = `(1 − cosine(median, mean)) × 10_000` in bps.
fn disagreement(props: &[AgentProposal], n: usize) -> u32 {
    if props.len() < 2 || n == 0 {
        return 0;
    }
    let median = median_alloc(props, n);
    let mean = mean_alloc(props, n);
    let cos_bps = cosine_bps(&median, &mean);
    TOTAL_BPS.saturating_sub(cos_bps)
}

fn mean_alloc(props: &[AgentProposal], n: usize) -> Vec<i64> {
    let count = props.len() as i64;
    let mut sums = vec![0i64; n];
    for p in props {
        for (i, bps) in p.allocation_bps.iter().enumerate() {
            sums[i] += *bps as i64;
        }
    }
    sums.iter().map(|s| s / count).collect()
}

fn median_alloc(props: &[AgentProposal], n: usize) -> Vec<i64> {
    let mut out = Vec::with_capacity(n);
    let mut col: Vec<i64> = Vec::with_capacity(props.len());
    for i in 0..n {
        col.clear();
        for p in props {
            col.push(p.allocation_bps[i] as i64);
        }
        col.sort();
        let m = if col.len() % 2 == 1 {
            col[col.len() / 2]
        } else {
            let a = col[col.len() / 2 - 1];
            let b = col[col.len() / 2];
            (a + b) / 2
        };
        out.push(m);
    }
    out
}

/// Integer cosine similarity scaled to bps. Returns a value in `[0, 10_000]`.
/// Implementation is byte-for-byte reproducible — no float math anywhere.
pub fn cosine_bps(a: &[i64], b: &[i64]) -> u32 {
    if a.len() != b.len() || a.is_empty() {
        return 0;
    }
    let mut dot: i128 = 0;
    let mut na: i128 = 0;
    let mut nb: i128 = 0;
    for i in 0..a.len() {
        let ai = a[i] as i128;
        let bi = b[i] as i128;
        dot = dot.saturating_add(ai * bi);
        na = na.saturating_add(ai * ai);
        nb = nb.saturating_add(bi * bi);
    }
    if dot <= 0 || na == 0 || nb == 0 {
        return 0;
    }
    let denom_sq = na.saturating_mul(nb);
    let denom = isqrt_u128(denom_sq as u128);
    if denom == 0 {
        return 0;
    }
    // cosine in bps = dot * 10_000 / denom; clamp to [0, 10_000].
    let val = (dot as u128).saturating_mul(TOTAL_BPS as u128) / denom as u128;
    val.min(TOTAL_BPS as u128) as u32
}

/// Newton's-method integer square root over `u128`. Deterministic across
/// architectures.
fn isqrt_u128(n: u128) -> u128 {
    if n < 2 {
        return n;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

fn clip_toward_current(
    target: &[u32],
    current: &[u32],
    disagreement_bps: u32,
    tau_disagree_bps: u32,
) -> (Vec<u32>, u32) {
    if current.len() != target.len() || disagreement_bps <= tau_disagree_bps {
        return (target.to_vec(), TOTAL_BPS);
    }
    let clip_factor_bps = TOTAL_BPS.saturating_sub(disagreement_bps);
    let mut clipped: Vec<u32> = target
        .iter()
        .zip(current.iter())
        .map(|(t, c)| {
            let t = *t as i64;
            let c = *c as i64;
            let delta = t - c;
            let scaled = delta * clip_factor_bps as i64 / TOTAL_BPS as i64;
            (c + scaled).max(0) as u32
        })
        .collect();
    renormalize(&mut clipped);
    (clipped, clip_factor_bps)
}

fn renormalize(v: &mut [u32]) {
    let sum: u64 = v.iter().map(|x| *x as u64).sum();
    if sum == TOTAL_BPS as u64 || v.is_empty() {
        return;
    }
    if sum > TOTAL_BPS as u64 {
        let mut over = sum - TOTAL_BPS as u64;
        // Trim from largest first.
        let mut order: Vec<usize> = (0..v.len()).collect();
        order.sort_by(|a, b| v[*b].cmp(&v[*a]));
        let mut i = 0;
        while over > 0 {
            let k = order[i % order.len()];
            if v[k] > 0 {
                v[k] -= 1;
                over -= 1;
            }
            i += 1;
            if i > 10 * v.len() {
                break;
            }
        }
    } else {
        let mut under = TOTAL_BPS as u64 - sum;
        let mut i = 0;
        while under > 0 {
            v[i % v.len()] += 1;
            under -= 1;
            i += 1;
        }
    }
}

fn consensus_root_from(props: &[AgentProposal]) -> [u8; 32] {
    let mut sorted: Vec<&AgentProposal> = props.iter().collect();
    sorted.sort_by_key(|p| p.agent_id as u8);
    let leaves: Vec<[u8; 32]> = sorted.iter().map(|p| p.proposal_commit()).collect();
    let refs: Vec<&[u8]> = leaves.iter().map(|l| l.as_slice()).collect();
    hash_with_tag(tags::CONSENSUS_V2, &refs)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(id: AgentId, conf: u32, alloc: Vec<u32>, veto: Option<VetoLevel>) -> AgentProposal {
        AgentProposal {
            agent_id: id,
            allocation_bps: alloc,
            confidence: conf,
            rejection_reasons: vec![],
            veto,
            reasoning_commit: [id as u8; 32],
        }
    }

    fn defensive_2() -> Vec<u32> {
        vec![6_000, 4_000]
    }

    #[test]
    fn hard_veto_collapses_to_defensive_byte_equal() {
        let defensive = defensive_2();
        let current = vec![5_000, 5_000];
        let acc = vec![(AgentId::TailRisk, 8_000), (AgentId::YieldMax, 9_000)];

        let proposals = vec![
            p(AgentId::YieldMax, 9_000, vec![10_000, 0], None),
            p(AgentId::TailRisk, 7_000, vec![0, 10_000], Some(VetoLevel::Hard)),
            p(AgentId::VolSuppress, 6_000, vec![3_000, 7_000], None),
        ];

        let outcome = resolve_consensus(ConsensusInput {
            proposals: &proposals,
            current_allocation: &current,
            defensive_allocation: &defensive,
            historical_accuracy_bps: &acc,
            tau_disagree_bps: TAU_DISAGREE_BPS,
        })
        .unwrap();

        assert!(outcome.defensive_triggered);
        assert_eq!(outcome.triggering_agent, Some(AgentId::TailRisk));
        assert_eq!(outcome.final_allocation, defensive);
    }

    #[test]
    fn unauthorized_hard_veto_is_rejected_at_validation() {
        let defensive = defensive_2();
        let current = vec![5_000, 5_000];
        let acc = vec![];
        let proposals = vec![p(
            AgentId::YieldMax,
            9_000,
            vec![10_000, 0],
            Some(VetoLevel::Hard),
        )];
        let err = resolve_consensus(ConsensusInput {
            proposals: &proposals,
            current_allocation: &current,
            defensive_allocation: &defensive,
            historical_accuracy_bps: &acc,
            tau_disagree_bps: TAU_DISAGREE_BPS,
        })
        .unwrap_err();
        assert!(matches!(err, ConsensusError::BadProposal { .. }));
    }

    #[test]
    fn unanimous_proposals_yield_those_proposals() {
        let defensive = defensive_2();
        let current = vec![5_000, 5_000];
        let acc = vec![];
        let proposals = vec![
            p(AgentId::YieldMax, 9_000, vec![6_000, 4_000], None),
            p(AgentId::ProtocolExposure, 9_000, vec![6_000, 4_000], None),
        ];
        let outcome = resolve_consensus(ConsensusInput {
            proposals: &proposals,
            current_allocation: &current,
            defensive_allocation: &defensive,
            historical_accuracy_bps: &acc,
            tau_disagree_bps: TAU_DISAGREE_BPS,
        })
        .unwrap();
        assert_eq!(outcome.final_allocation, vec![6_000, 4_000]);
        assert_eq!(outcome.disagreement_bps, 0);
    }

    #[test]
    fn final_allocation_always_sums_to_10000() {
        let defensive = defensive_2();
        let current = vec![5_000, 5_000];
        let acc = vec![];
        let proposals = vec![
            p(AgentId::YieldMax, 9_000, vec![3_000, 7_000], None),
            p(AgentId::VolSuppress, 5_000, vec![6_000, 4_000], None),
            p(AgentId::ExecEfficiency, 7_500, vec![5_000, 5_000], None),
        ];
        let outcome = resolve_consensus(ConsensusInput {
            proposals: &proposals,
            current_allocation: &current,
            defensive_allocation: &defensive,
            historical_accuracy_bps: &acc,
            tau_disagree_bps: TAU_DISAGREE_BPS,
        })
        .unwrap();
        assert_eq!(outcome.final_allocation.iter().sum::<u32>(), TOTAL_BPS);
    }

    #[test]
    fn cosine_orthogonal_is_zero() {
        let a = vec![10_000, 0, 0];
        let b = vec![0, 10_000, 0];
        assert_eq!(cosine_bps(&a, &b), 0);
    }

    #[test]
    fn cosine_identical_is_10000() {
        let a = vec![3_000, 4_000, 3_000];
        assert_eq!(cosine_bps(&a, &a), TOTAL_BPS);
    }

    #[test]
    fn isqrt_known_values() {
        assert_eq!(isqrt_u128(0), 0);
        assert_eq!(isqrt_u128(1), 1);
        assert_eq!(isqrt_u128(15), 3);
        assert_eq!(isqrt_u128(16), 4);
        assert_eq!(isqrt_u128(99_999_999_999_999_999_999u128), 9_999_999_999u128);
    }

    #[test]
    fn high_disagreement_clips_toward_current() {
        let defensive = defensive_2();
        let current = vec![5_000, 5_000];
        let acc = vec![(AgentId::YieldMax, 9_000), (AgentId::VolSuppress, 8_000)];
        // Two proposals point to opposite extremes — high disagreement.
        let proposals = vec![
            p(AgentId::YieldMax, 9_000, vec![10_000, 0], None),
            p(AgentId::VolSuppress, 9_000, vec![0, 10_000], None),
        ];
        let outcome = resolve_consensus(ConsensusInput {
            proposals: &proposals,
            current_allocation: &current,
            defensive_allocation: &defensive,
            historical_accuracy_bps: &acc,
            tau_disagree_bps: TAU_DISAGREE_BPS,
        })
        .unwrap();
        // High-disagreement final must lie closer to current than to either extreme.
        let dist_curr: i64 = outcome
            .final_allocation
            .iter()
            .zip(current.iter())
            .map(|(a, b)| (*a as i64 - *b as i64).abs())
            .sum();
        let dist_yieldmax: i64 = outcome
            .final_allocation
            .iter()
            .zip([10_000u32, 0].iter())
            .map(|(a, b)| (*a as i64 - *b as i64).abs())
            .sum();
        assert!(dist_curr < dist_yieldmax);
    }

    #[test]
    fn consensus_root_order_invariant() {
        let proposals_a = vec![
            p(AgentId::YieldMax, 5_000, vec![5_000, 5_000], None),
            p(AgentId::VolSuppress, 5_000, vec![5_000, 5_000], None),
        ];
        let proposals_b = vec![
            p(AgentId::VolSuppress, 5_000, vec![5_000, 5_000], None),
            p(AgentId::YieldMax, 5_000, vec![5_000, 5_000], None),
        ];
        assert_eq!(
            consensus_root_from(&proposals_a),
            consensus_root_from(&proposals_b)
        );
    }
}

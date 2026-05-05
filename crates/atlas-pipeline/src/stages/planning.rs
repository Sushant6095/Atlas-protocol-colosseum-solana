//! Stage 12 — PlanExecution + 9.1 ALT Engine + 9.2 Compute Budget Intelligence.
//!
//! Outputs a `CpiPlan` that the synthesize/simulate/submit stages consume.
//! Hard rules from directive §9:
//!   - Per-protocol ALT, content-addressed by the set of accounts it covers.
//!   - ALT compaction collapses pairs with ≥80% intersection.
//!   - CU prediction = `Σ p99(cu_per_cpi_i) + 15% buffer`.
//!   - If predicted CU > 1_400_000, segment into multiple transactions joined
//!     by intent records — never silently drop legs.
//!   - Set `set_compute_unit_price` from a fee oracle, bounded by vault max.

use crate::hashing::{hash_with_tag, tags};
use std::collections::BTreeSet;

pub const CU_BUDGET_PER_TX: u32 = 1_400_000;
pub const CU_BUFFER_BPS: u32 = 1_500; // 15% buffer

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ProtocolId(pub u8);

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct AccountKey(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CpiLeg {
    pub protocol: ProtocolId,
    /// Bps of NAV moved by this leg.
    pub intended_delta_bps: i32,
    /// Predicted CU for this leg, taken from the per-protocol p99 histogram.
    pub predicted_cu: u32,
    pub writable_accounts: BTreeSet<AccountKey>,
    pub readonly_accounts: BTreeSet<AccountKey>,
}

impl CpiLeg {
    /// Stable byte-level commitment over leg parameters — feeds the plan root.
    pub fn commit(&self) -> [u8; 32] {
        let mut chunks: Vec<&[u8]> = Vec::new();
        let proto = [self.protocol.0];
        let delta = self.intended_delta_bps.to_le_bytes();
        let cu = self.predicted_cu.to_le_bytes();
        chunks.push(&proto);
        chunks.push(&delta);
        chunks.push(&cu);
        for w in &self.writable_accounts {
            chunks.push(&w.0);
        }
        chunks.push(b"|");
        for r in &self.readonly_accounts {
            chunks.push(&r.0);
        }
        hash_with_tag(tags::RISK_V2, &chunks)
    }
}

/// One ALT entry — content-addressed by the set of accounts it covers.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AltDescriptor {
    pub protocol: ProtocolId,
    pub accounts: BTreeSet<AccountKey>,
    pub alt_id: [u8; 32],
}

impl AltDescriptor {
    pub fn new(protocol: ProtocolId, accounts: BTreeSet<AccountKey>) -> Self {
        let mut chunks: Vec<&[u8]> = Vec::new();
        let proto = [protocol.0];
        chunks.push(&proto);
        for a in &accounts {
            chunks.push(&a.0);
        }
        let alt_id = hash_with_tag(b"atlas.alt.v1", &chunks);
        Self { protocol, accounts, alt_id }
    }
}

/// Collapse ALTs whose intersection ratio is ≥ `threshold_bps` (10_000 = identical).
/// Pairs are merged greedily, lowest-intersection-pair first eliminated.
pub fn compact_alts(mut alts: Vec<AltDescriptor>, threshold_bps: u32) -> Vec<AltDescriptor> {
    let mut changed = true;
    while changed {
        changed = false;
        let n = alts.len();
        let mut merge_pair: Option<(usize, usize)> = None;
        for i in 0..n {
            for j in (i + 1)..n {
                let inter = alts[i].accounts.intersection(&alts[j].accounts).count() as u64;
                let smaller = alts[i].accounts.len().min(alts[j].accounts.len()) as u64;
                if smaller == 0 {
                    continue;
                }
                let ratio_bps = (inter * 10_000 / smaller) as u32;
                if ratio_bps >= threshold_bps {
                    merge_pair = Some((i, j));
                    break;
                }
            }
            if merge_pair.is_some() {
                break;
            }
        }
        if let Some((i, j)) = merge_pair {
            let b = alts.remove(j);
            let a = alts.remove(i);
            let mut union: BTreeSet<AccountKey> = a.accounts.clone();
            union.extend(b.accounts);
            alts.push(AltDescriptor::new(a.protocol, union));
            changed = true;
        }
    }
    // Stable ordering: by protocol id then alt_id.
    alts.sort_by(|a, b| a.protocol.cmp(&b.protocol).then(a.alt_id.cmp(&b.alt_id)));
    alts
}

/// Per-protocol histogram of CU-per-CPI samples (bounded ring of last 1000).
#[derive(Clone, Debug, Default)]
pub struct CuHistogram {
    samples: Vec<u32>, // sorted insertion order; we sort on read
    cap: usize,
}

impl CuHistogram {
    pub fn new(cap: usize) -> Self {
        Self { samples: Vec::new(), cap }
    }

    pub fn record(&mut self, cu: u32) {
        if self.samples.len() == self.cap && self.cap > 0 {
            self.samples.remove(0);
        }
        self.samples.push(cu);
    }

    /// p99 from a *copy* of the buffer — original ordering preserved (matters
    /// for deterministic eviction). Returns 0 if no samples yet.
    pub fn p99(&self) -> u32 {
        if self.samples.is_empty() {
            return 0;
        }
        let mut sorted = self.samples.clone();
        sorted.sort();
        // p99 index = ceil(0.99 * (n - 1))
        let n = sorted.len();
        let idx = ((n - 1) as u64 * 99 + 99) / 100;
        sorted[(idx as usize).min(n - 1)]
    }

    pub fn len(&self) -> usize {
        self.samples.len()
    }
}

/// Predicted CU for a leg list = sum of per-leg p99 + 15% buffer.
pub fn predict_cu(legs: &[CpiLeg]) -> u32 {
    let raw: u64 = legs.iter().map(|l| l.predicted_cu as u64).sum();
    let with_buffer = raw + (raw * CU_BUFFER_BPS as u64) / 10_000;
    with_buffer.min(u32::MAX as u64) as u32
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CpiPlan {
    pub legs: Vec<CpiLeg>,
    pub predicted_cu: u32,
    pub plan_root: [u8; 32],
}

impl CpiPlan {
    pub fn new(legs: Vec<CpiLeg>) -> Self {
        let predicted_cu = predict_cu(&legs);
        let leaves: Vec<[u8; 32]> = legs.iter().map(|l| l.commit()).collect();
        let refs: Vec<&[u8]> = leaves.iter().map(|l| l.as_slice()).collect();
        let plan_root = hash_with_tag(b"atlas.cpiplan.v1", &refs);
        Self { legs, predicted_cu, plan_root }
    }
}

/// Stage 13 — SynthesizeTx (segmentation logic).
///
/// If the predicted CU for a single plan exceeds `CU_BUDGET_PER_TX`, the legs
/// are split into the minimal number of segments such that each segment fits.
/// Each segment carries an ordered intent index so the on-chain `record_rb`
/// instruction can verify segments are applied in order. We never silently
/// drop legs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TxSegment {
    pub index: u8,
    pub legs: Vec<CpiLeg>,
    pub predicted_cu: u32,
}

pub fn segment_plan(plan: &CpiPlan) -> Vec<TxSegment> {
    if plan.predicted_cu <= CU_BUDGET_PER_TX {
        return vec![TxSegment {
            index: 0,
            legs: plan.legs.clone(),
            predicted_cu: plan.predicted_cu,
        }];
    }

    let mut segments = Vec::new();
    let mut current: Vec<CpiLeg> = Vec::new();
    let mut current_cu_raw: u64 = 0;
    let mut idx: u8 = 0;
    for leg in &plan.legs {
        let leg_with_buffer = (leg.predicted_cu as u64 * (10_000 + CU_BUFFER_BPS as u64)) / 10_000;
        if !current.is_empty() && current_cu_raw + leg_with_buffer > CU_BUDGET_PER_TX as u64 {
            let cu = predict_cu(&current);
            segments.push(TxSegment {
                index: idx,
                legs: std::mem::take(&mut current),
                predicted_cu: cu,
            });
            idx = idx.saturating_add(1);
            current_cu_raw = 0;
        }
        current_cu_raw += leg_with_buffer;
        current.push(leg.clone());
    }
    if !current.is_empty() {
        let cu = predict_cu(&current);
        segments.push(TxSegment {
            index: idx,
            legs: current,
            predicted_cu: cu,
        });
    }
    segments
}

#[cfg(test)]
mod tests {
    use super::*;

    fn k(b: u8) -> AccountKey {
        AccountKey([b; 32])
    }

    fn leg(proto: u8, cu: u32, ws: &[u8], rs: &[u8]) -> CpiLeg {
        CpiLeg {
            protocol: ProtocolId(proto),
            intended_delta_bps: 100,
            predicted_cu: cu,
            writable_accounts: ws.iter().map(|b| k(*b)).collect(),
            readonly_accounts: rs.iter().map(|b| k(*b)).collect(),
        }
    }

    #[test]
    fn cu_budget_buffer_is_15_percent() {
        let legs = vec![leg(1, 100_000, &[], &[]), leg(2, 200_000, &[], &[])];
        // 300_000 + 15% = 345_000
        assert_eq!(predict_cu(&legs), 345_000);
    }

    #[test]
    fn p99_known_distribution() {
        let mut h = CuHistogram::new(100);
        for v in 1u32..=100 {
            h.record(v * 1_000);
        }
        // p99 of [1..=100] (in thousands) = 100_000 (last bucket)
        assert!(h.p99() >= 99_000);
    }

    #[test]
    fn ring_evicts_oldest() {
        let mut h = CuHistogram::new(3);
        h.record(10);
        h.record(20);
        h.record(30);
        h.record(40);
        assert_eq!(h.len(), 3);
        // 10 should have been evicted; smallest sample is now 20.
        let mut sorted = h.samples.clone();
        sorted.sort();
        assert_eq!(sorted[0], 20);
    }

    #[test]
    fn alt_id_is_content_addressed() {
        let a1 = AltDescriptor::new(ProtocolId(1), [k(1), k(2), k(3)].into_iter().collect());
        let a2 = AltDescriptor::new(ProtocolId(1), [k(3), k(2), k(1)].into_iter().collect());
        assert_eq!(a1.alt_id, a2.alt_id);
    }

    #[test]
    fn alt_compaction_merges_high_overlap() {
        let a = AltDescriptor::new(ProtocolId(1), (0u8..10).map(k).collect());
        let b = AltDescriptor::new(ProtocolId(1), (0u8..9).map(k).collect()); // 9/9 = 100% of smaller
        let merged = compact_alts(vec![a.clone(), b.clone()], 8_000);
        assert_eq!(merged.len(), 1);
        assert!(merged[0].accounts.len() >= a.accounts.len());
    }

    #[test]
    fn alt_compaction_keeps_distinct() {
        let a = AltDescriptor::new(ProtocolId(1), (0u8..5).map(k).collect());
        let b = AltDescriptor::new(ProtocolId(2), (10u8..15).map(k).collect());
        let merged = compact_alts(vec![a, b], 8_000);
        assert_eq!(merged.len(), 2);
    }

    #[test]
    fn segment_under_budget_is_single_segment() {
        let plan = CpiPlan::new(vec![leg(1, 200_000, &[], &[]), leg(2, 300_000, &[], &[])]);
        let segs = segment_plan(&plan);
        assert_eq!(segs.len(), 1);
    }

    #[test]
    fn segment_over_budget_splits_no_drops() {
        // Predicted per leg ~600k → ~690k with buffer. Two legs = 1.38M just inside;
        // four legs = 2.76M → must split.
        let plan = CpiPlan::new(vec![
            leg(1, 600_000, &[], &[]),
            leg(2, 600_000, &[], &[]),
            leg(3, 600_000, &[], &[]),
            leg(4, 600_000, &[], &[]),
        ]);
        let segs = segment_plan(&plan);
        // No legs dropped — total leg count must equal original.
        let total: usize = segs.iter().map(|s| s.legs.len()).sum();
        assert_eq!(total, 4);
        // Every segment must fit inside the budget.
        for s in &segs {
            assert!(s.predicted_cu <= CU_BUDGET_PER_TX, "segment over budget: {}", s.predicted_cu);
        }
        // Indices monotonic from 0.
        for (i, s) in segs.iter().enumerate() {
            assert_eq!(s.index as usize, i);
        }
    }

    #[test]
    fn plan_root_deterministic() {
        let p1 = CpiPlan::new(vec![leg(1, 100_000, &[1, 2], &[3])]);
        let p2 = CpiPlan::new(vec![leg(1, 100_000, &[1, 2], &[3])]);
        assert_eq!(p1.plan_root, p2.plan_root);
    }
}

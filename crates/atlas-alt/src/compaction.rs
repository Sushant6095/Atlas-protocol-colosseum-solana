//! ALT compaction (directive §2.2 fifth bullet).
//!
//! Pairs of warm ALTs whose Jaccard similarity exceeds 80 % collapse
//! into a merged ALT. The merged ALT's account set is the union; the
//! two source ALTs are deactivated once the merged one is warm.

use crate::lifecycle::{alt_id, AltRecord, AltStatus};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub const COMPACTION_THRESHOLD_BPS: u32 = 8_000; // 80 %

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompactionPair {
    pub a_alt_id: [u8; 32],
    pub b_alt_id: [u8; 32],
    pub jaccard_bps: u32,
    pub merged_alt_id: [u8; 32],
    pub merged_account_count: usize,
}

/// Compute Jaccard similarity (intersection / union) in bps.
pub fn jaccard_bps(a: &AltRecord, b: &AltRecord) -> u32 {
    let aset: BTreeSet<_> = a.accounts.iter().collect();
    let bset: BTreeSet<_> = b.accounts.iter().collect();
    let inter = aset.intersection(&bset).count() as u128;
    let union = aset.union(&bset).count() as u128;
    if union == 0 {
        return 0;
    }
    (inter * 10_000 / union).min(10_000) as u32
}

/// Find pairs of warm ALTs that should be compacted. Returns one row
/// per candidate pair. Caller decides whether to actually merge — this
/// function only ranks candidates.
pub fn compaction_candidates(alts: &[AltRecord]) -> Vec<CompactionPair> {
    let mut out = Vec::new();
    for i in 0..alts.len() {
        if alts[i].status != AltStatus::Warm {
            continue;
        }
        for j in (i + 1)..alts.len() {
            if alts[j].status != AltStatus::Warm {
                continue;
            }
            let bps = jaccard_bps(&alts[i], &alts[j]);
            if bps < COMPACTION_THRESHOLD_BPS {
                continue;
            }
            let mut union: BTreeSet<[u8; 32]> = alts[i].accounts.iter().copied().collect();
            for a in &alts[j].accounts {
                union.insert(*a);
            }
            let merged: Vec<[u8; 32]> = union.into_iter().collect();
            out.push(CompactionPair {
                a_alt_id: alts[i].alt_id,
                b_alt_id: alts[j].alt_id,
                jaccard_bps: bps,
                merged_alt_id: alt_id(&merged),
                merged_account_count: merged.len(),
            });
        }
    }
    // Highest similarity first — operator collapses the cheapest wins.
    out.sort_by(|a, b| b.jaccard_bps.cmp(&a.jaccard_bps));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_runtime::Pubkey;

    fn k(b: u8) -> Pubkey { [b; 32] }

    fn warm(accounts: BTreeSet<Pubkey>) -> AltRecord {
        let mut a = AltRecord::new(accounts, 100).unwrap();
        a.mark_warm(200).unwrap();
        a
    }

    #[test]
    fn jaccard_identical_is_unit() {
        let s = BTreeSet::from([k(1), k(2), k(3)]);
        let a = warm(s.clone());
        let b = warm(s);
        assert_eq!(jaccard_bps(&a, &b), 10_000);
    }

    #[test]
    fn jaccard_disjoint_is_zero() {
        let a = warm(BTreeSet::from([k(1), k(2)]));
        let b = warm(BTreeSet::from([k(3), k(4)]));
        assert_eq!(jaccard_bps(&a, &b), 0);
    }

    #[test]
    fn high_overlap_emits_compaction_candidate() {
        // Jaccard = |A ∩ B| / |A ∪ B|. Intersection 4, union 5 → 80 %.
        let a = warm(BTreeSet::from([k(1), k(2), k(3), k(4)]));
        let b = warm(BTreeSet::from([k(1), k(2), k(3), k(4), k(5)]));
        let candidates = compaction_candidates(&[a, b]);
        assert_eq!(candidates.len(), 1);
        assert!(candidates[0].jaccard_bps >= COMPACTION_THRESHOLD_BPS);
        assert_eq!(candidates[0].merged_account_count, 5);
    }

    #[test]
    fn low_overlap_below_threshold_emits_nothing() {
        let a = warm(BTreeSet::from([k(1), k(2), k(3)]));
        let b = warm(BTreeSet::from([k(2), k(4), k(5)]));
        // 1/5 overlap = 20 %.
        assert!(compaction_candidates(&[a, b]).is_empty());
    }

    #[test]
    fn pending_alts_are_skipped() {
        let a = warm(BTreeSet::from([k(1), k(2), k(3), k(4), k(5)]));
        let b = AltRecord::new(BTreeSet::from([k(1), k(2), k(3), k(4), k(6)]), 100).unwrap();
        // b is Pending → skip the pair.
        assert!(compaction_candidates(&[a, b]).is_empty());
    }

    #[test]
    fn candidates_sorted_descending_by_similarity() {
        let a = warm(BTreeSet::from([k(1), k(2), k(3), k(4), k(5)]));
        let b = warm(BTreeSet::from([k(1), k(2), k(3), k(4), k(5)])); // 100 % vs a
        let c = warm(BTreeSet::from([k(1), k(2), k(3), k(4)])); // 80 % vs a/b
        let v = compaction_candidates(&[a, b, c]);
        assert!(v.len() >= 2);
        assert_eq!(v[0].jaccard_bps, 10_000);
        assert!(v[1].jaccard_bps <= v[0].jaccard_bps);
    }
}

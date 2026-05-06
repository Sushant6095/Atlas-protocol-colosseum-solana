//! Account write-lock discipline (directive §1).

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub type Pubkey = [u8; 32];

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LockClassification {
    Writable,
    Readonly,
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct AccountLockSet {
    pub writable: BTreeSet<Pubkey>,
    pub readonly: BTreeSet<Pubkey>,
}

impl AccountLockSet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, pubkey: Pubkey, kind: LockClassification) {
        match kind {
            LockClassification::Writable => {
                self.readonly.remove(&pubkey);
                self.writable.insert(pubkey);
            }
            LockClassification::Readonly => {
                if !self.writable.contains(&pubkey) {
                    self.readonly.insert(pubkey);
                }
            }
        }
    }

    pub fn writable_len(&self) -> usize {
        self.writable.len()
    }

    pub fn readonly_len(&self) -> usize {
        self.readonly.len()
    }

    pub fn total_len(&self) -> usize {
        self.writable_len() + self.readonly_len()
    }

    /// Union of two lock sets — writable in either input is writable in
    /// the result; readonly stays readonly only when both sides agreed.
    pub fn union(&self, other: &AccountLockSet) -> AccountLockSet {
        let mut out = AccountLockSet::default();
        for k in &self.writable {
            out.writable.insert(*k);
        }
        for k in &other.writable {
            out.writable.insert(*k);
        }
        for k in self.readonly.union(&other.readonly) {
            if !out.writable.contains(k) {
                out.readonly.insert(*k);
            }
        }
        out
    }

    /// Directive §1.3 SLO guard. p99 ≤ 64 writable accounts per bundle —
    /// this returns `true` if the current set is within SLO bounds for an
    /// individual bundle. Callers track the rolling p99 separately.
    pub fn within_writable_slo(&self) -> bool {
        self.writable_len() <= 64
    }
}

/// Directive §1.2 cross-vault writable check. Returns the set of
/// pubkeys that two distinct vaults' lock sets both claim writable —
/// the directive forbids this.
pub fn lock_collision_set(a: &AccountLockSet, b: &AccountLockSet) -> BTreeSet<Pubkey> {
    a.writable.intersection(&b.writable).copied().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn k(b: u8) -> Pubkey { [b; 32] }

    #[test]
    fn writable_supersedes_readonly() {
        let mut s = AccountLockSet::new();
        s.add(k(1), LockClassification::Readonly);
        s.add(k(1), LockClassification::Writable);
        assert!(s.writable.contains(&k(1)));
        assert!(!s.readonly.contains(&k(1)));
    }

    #[test]
    fn duplicate_readonly_is_idempotent() {
        let mut s = AccountLockSet::new();
        s.add(k(1), LockClassification::Readonly);
        s.add(k(1), LockClassification::Readonly);
        assert_eq!(s.readonly_len(), 1);
    }

    #[test]
    fn union_merges_writable_correctly() {
        let mut a = AccountLockSet::new();
        a.add(k(1), LockClassification::Writable);
        a.add(k(2), LockClassification::Readonly);
        let mut b = AccountLockSet::new();
        b.add(k(2), LockClassification::Writable);
        b.add(k(3), LockClassification::Readonly);
        let u = a.union(&b);
        assert!(u.writable.contains(&k(1)));
        assert!(u.writable.contains(&k(2)));
        assert!(u.readonly.contains(&k(3)));
        assert!(!u.readonly.contains(&k(2)));
    }

    #[test]
    fn slo_guard_at_64_writable() {
        let mut s = AccountLockSet::new();
        for i in 0..64u8 {
            s.add(k(i), LockClassification::Writable);
        }
        assert!(s.within_writable_slo());
        s.add(k(200), LockClassification::Writable);
        assert!(!s.within_writable_slo());
    }

    #[test]
    fn cross_vault_collision_detected() {
        let mut a = AccountLockSet::new();
        a.add(k(1), LockClassification::Writable);
        a.add(k(2), LockClassification::Writable);
        let mut b = AccountLockSet::new();
        b.add(k(2), LockClassification::Writable);
        b.add(k(3), LockClassification::Writable);
        let coll = lock_collision_set(&a, &b);
        assert_eq!(coll, BTreeSet::from([k(2)]));
    }
}

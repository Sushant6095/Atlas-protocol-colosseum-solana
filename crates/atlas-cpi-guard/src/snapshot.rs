//! Pre/post account snapshotting + diff invariant (directive §4.2 first bullet).

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccountSnapshot {
    pub pubkey: Pubkey,
    pub lamports: u64,
    pub owner: Pubkey,
    /// blake3 of the account data — comparing hashes is enough to
    /// detect any byte-level change without exposing the full data.
    pub data_hash: [u8; 32],
}

/// Whitelist of fields that are allowed to differ between pre and post
/// snapshots. Anything else is a violation. The list is per-CPI: a
/// Kamino deposit allows lamports + data_hash on the user-token
/// account but not on the vault-state account.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AllowedField {
    Lamports,
    DataHash,
    /// Owner changes are special — only the system program is allowed
    /// to change owner, so this is rare. Keep it explicit.
    Owner,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotDiffViolation {
    pub pubkey: Pubkey,
    pub kind: ViolationKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViolationKind {
    UnauthorizedLamports,
    UnauthorizedOwnerChange,
    UnauthorizedDataMutation,
    AccountMissingPostCpi,
    AccountAppearedPostCpi,
}

/// Compute a snapshot from raw inputs. Crate consumers feed in the
/// post-CPI state of an account they care about.
pub fn snapshot(pubkey: Pubkey, lamports: u64, owner: Pubkey, data: &[u8]) -> AccountSnapshot {
    let data_hash = *blake3::hash(data).as_bytes();
    AccountSnapshot { pubkey, lamports, owner, data_hash }
}

/// Diff two snapshot lists. The two lists are paired by pubkey; the
/// allowed-field map says which fields are permitted to change for
/// each pubkey. Returns a list of violations — empty means I-10
/// passed.
pub fn diff_snapshots(
    pre: &[AccountSnapshot],
    post: &[AccountSnapshot],
    allowed: &std::collections::BTreeMap<Pubkey, Vec<AllowedField>>,
) -> Vec<SnapshotDiffViolation> {
    let mut out = Vec::new();
    let mut post_by_key: std::collections::BTreeMap<Pubkey, &AccountSnapshot> =
        post.iter().map(|s| (s.pubkey, s)).collect();
    for p in pre {
        let q = match post_by_key.remove(&p.pubkey) {
            Some(q) => q,
            None => {
                out.push(SnapshotDiffViolation {
                    pubkey: p.pubkey,
                    kind: ViolationKind::AccountMissingPostCpi,
                });
                continue;
            }
        };
        let permits = allowed.get(&p.pubkey).map(|v| v.as_slice()).unwrap_or(&[]);
        if p.lamports != q.lamports && !permits.contains(&AllowedField::Lamports) {
            out.push(SnapshotDiffViolation {
                pubkey: p.pubkey,
                kind: ViolationKind::UnauthorizedLamports,
            });
        }
        if p.data_hash != q.data_hash && !permits.contains(&AllowedField::DataHash) {
            out.push(SnapshotDiffViolation {
                pubkey: p.pubkey,
                kind: ViolationKind::UnauthorizedDataMutation,
            });
        }
        if p.owner != q.owner && !permits.contains(&AllowedField::Owner) {
            out.push(SnapshotDiffViolation {
                pubkey: p.pubkey,
                kind: ViolationKind::UnauthorizedOwnerChange,
            });
        }
    }
    // Anything left in post_by_key appeared between snapshots.
    for (k, _) in post_by_key {
        out.push(SnapshotDiffViolation {
            pubkey: k,
            kind: ViolationKind::AccountAppearedPostCpi,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn k(b: u8) -> Pubkey { [b; 32] }

    fn snap(pk: Pubkey, lamports: u64, owner: Pubkey, hash: u8) -> AccountSnapshot {
        AccountSnapshot { pubkey: pk, lamports, owner, data_hash: [hash; 32] }
    }

    #[test]
    fn no_change_passes() {
        let pre = vec![snap(k(1), 1_000, k(99), 0xa)];
        let post = vec![snap(k(1), 1_000, k(99), 0xa)];
        let allowed = BTreeMap::new();
        assert!(diff_snapshots(&pre, &post, &allowed).is_empty());
    }

    #[test]
    fn permitted_lamports_change_passes() {
        let pre = vec![snap(k(1), 1_000, k(99), 0xa)];
        let post = vec![snap(k(1), 800, k(99), 0xa)];
        let mut allowed = BTreeMap::new();
        allowed.insert(k(1), vec![AllowedField::Lamports]);
        assert!(diff_snapshots(&pre, &post, &allowed).is_empty());
    }

    #[test]
    fn unpermitted_data_mutation_violates() {
        let pre = vec![snap(k(1), 1_000, k(99), 0xa)];
        let post = vec![snap(k(1), 1_000, k(99), 0xb)];
        let allowed = BTreeMap::new();
        let v = diff_snapshots(&pre, &post, &allowed);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].kind, ViolationKind::UnauthorizedDataMutation);
    }

    #[test]
    fn unpermitted_owner_change_violates() {
        let pre = vec![snap(k(1), 1_000, k(99), 0xa)];
        let post = vec![snap(k(1), 1_000, k(50), 0xa)];
        let allowed = BTreeMap::new();
        let v = diff_snapshots(&pre, &post, &allowed);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].kind, ViolationKind::UnauthorizedOwnerChange);
    }

    #[test]
    fn missing_account_post_cpi_violates() {
        let pre = vec![snap(k(1), 1_000, k(99), 0xa)];
        let post: Vec<AccountSnapshot> = vec![];
        let allowed = BTreeMap::new();
        let v = diff_snapshots(&pre, &post, &allowed);
        assert_eq!(v[0].kind, ViolationKind::AccountMissingPostCpi);
    }

    #[test]
    fn appeared_account_post_cpi_violates() {
        let pre: Vec<AccountSnapshot> = vec![];
        let post = vec![snap(k(2), 1_000, k(99), 0xa)];
        let allowed = BTreeMap::new();
        let v = diff_snapshots(&pre, &post, &allowed);
        assert_eq!(v[0].kind, ViolationKind::AccountAppearedPostCpi);
    }
}

//! `DisclosurePolicy` + viewing-key issuance / rotation / revocation
//! (directive §6).
//!
//! Policy hash enters every proof's public input
//! (`disclosure_policy_hash`). Changing the policy requires the
//! multisig + a vault upgrade event (the strategy commitment binds
//! the policy).

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DisclosureRole {
    PublicAuditor,
    RegulatorTimeWindowed,
    FinanceAdmin,
    Operator,
    Recipient,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DisclosureScope {
    AggregateOnly,
    PerProtocol,
    PerTransaction,
    RecipientList,
    Full,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewingKeyKind {
    ElGamal,
    AuditorEphemeral,
    RecipientSpecific,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewingKeyStatus {
    Active,
    Revoked,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DisclosurePolicyEntry {
    pub role: DisclosureRole,
    pub scope: DisclosureScope,
    pub time_window: Option<(u64, u64)>,
    pub max_disclosures_per_window: Option<u32>,
    pub viewing_key_kind: ViewingKeyKind,
    pub revocable: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DisclosurePolicy {
    pub roles: Vec<DisclosurePolicyEntry>,
    pub revocation_authority: Pubkey,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DisclosurePolicyError {
    #[error("policy contains no role entries")]
    Empty,
    #[error("Full scope is reserved for FinanceAdmin role; got {0:?}")]
    FullScopeNotForRole(DisclosureRole),
    #[error("RegulatorTimeWindowed entry missing time_window")]
    RegulatorMissingWindow,
    #[error("revocation_authority pubkey is null")]
    NullRevocationAuthority,
    #[error("duplicate role entry for {0:?}")]
    DuplicateRole(DisclosureRole),
}

impl DisclosurePolicy {
    pub fn validate(&self) -> Result<(), DisclosurePolicyError> {
        if self.roles.is_empty() {
            return Err(DisclosurePolicyError::Empty);
        }
        if self.revocation_authority == [0u8; 32] {
            return Err(DisclosurePolicyError::NullRevocationAuthority);
        }
        let mut seen = std::collections::BTreeSet::new();
        for entry in &self.roles {
            if !seen.insert(entry.role) {
                return Err(DisclosurePolicyError::DuplicateRole(entry.role));
            }
            if entry.scope == DisclosureScope::Full && entry.role != DisclosureRole::FinanceAdmin {
                return Err(DisclosurePolicyError::FullScopeNotForRole(entry.role));
            }
            if entry.role == DisclosureRole::RegulatorTimeWindowed && entry.time_window.is_none() {
                return Err(DisclosurePolicyError::RegulatorMissingWindow);
            }
        }
        Ok(())
    }

    /// `disclosure_policy_hash = blake3("atlas.disclosure.v1" ||
    ///   canonical bytes)`. Enters the v3 public input.
    pub fn commitment_hash(&self) -> [u8; 32] {
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.disclosure.v1");
        h.update(&self.revocation_authority);
        h.update(&(self.roles.len() as u32).to_le_bytes());
        let mut sorted: Vec<&DisclosurePolicyEntry> = self.roles.iter().collect();
        sorted.sort_by_key(|e| e.role);
        for e in sorted {
            h.update(&[e.role as u8]);
            h.update(&[e.scope as u8]);
            h.update(&[e.viewing_key_kind as u8]);
            h.update(&[e.revocable as u8]);
            if let Some((s, e2)) = e.time_window {
                h.update(&s.to_le_bytes());
                h.update(&e2.to_le_bytes());
            }
            if let Some(max) = e.max_disclosures_per_window {
                h.update(&max.to_le_bytes());
            }
        }
        *h.finalize().as_bytes()
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ViewingKey {
    pub key_id: [u8; 32],
    pub vault_id: Pubkey,
    pub holder: Pubkey,
    pub role: DisclosureRole,
    pub scope: DisclosureScope,
    pub kind: ViewingKeyKind,
    pub time_window: Option<(u64, u64)>,
    pub status: ViewingKeyStatus,
    pub issued_at_slot: u64,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ViewingKeyError {
    #[error("policy has no entry for role {0:?}")]
    RoleNotInPolicy(DisclosureRole),
    #[error("requested scope {requested:?} exceeds policy scope {policy:?}")]
    ScopeExceedsPolicy {
        policy: DisclosureScope,
        requested: DisclosureScope,
    },
    #[error("viewing key revoked")]
    Revoked,
    #[error("viewing key outside its time window: now={now}, window={window:?}")]
    OutsideWindow { now: u64, window: Option<(u64, u64)> },
}

/// Issue a viewing key against a policy. Refuses to issue keys whose
/// scope exceeds the policy's declaration for the role.
pub fn issue_viewing_key(
    vault_id: Pubkey,
    holder: Pubkey,
    role: DisclosureRole,
    requested_scope: DisclosureScope,
    issued_at_slot: u64,
    policy: &DisclosurePolicy,
) -> Result<ViewingKey, ViewingKeyError> {
    let entry = policy
        .roles
        .iter()
        .find(|e| e.role == role)
        .ok_or(ViewingKeyError::RoleNotInPolicy(role))?;
    if !scope_within(requested_scope, entry.scope) {
        return Err(ViewingKeyError::ScopeExceedsPolicy {
            policy: entry.scope,
            requested: requested_scope,
        });
    }
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.viewing_key.v1");
    h.update(&vault_id);
    h.update(&holder);
    h.update(&[role as u8]);
    h.update(&[requested_scope as u8]);
    h.update(&issued_at_slot.to_le_bytes());
    let key_id = *h.finalize().as_bytes();
    Ok(ViewingKey {
        key_id,
        vault_id,
        holder,
        role,
        scope: requested_scope,
        kind: entry.viewing_key_kind,
        time_window: entry.time_window,
        status: ViewingKeyStatus::Active,
        issued_at_slot,
    })
}

/// Validate a viewing key at use time: revocation, time window.
pub fn validate_viewing_key(key: &ViewingKey, now_slot: u64) -> Result<(), ViewingKeyError> {
    if key.status == ViewingKeyStatus::Revoked {
        return Err(ViewingKeyError::Revoked);
    }
    if let Some((s, e)) = key.time_window {
        if now_slot < s || now_slot >= e {
            return Err(ViewingKeyError::OutsideWindow { now: now_slot, window: key.time_window });
        }
    }
    Ok(())
}

pub fn revoke_viewing_key(key: &mut ViewingKey) {
    key.status = ViewingKeyStatus::Revoked;
}

fn scope_within(requested: DisclosureScope, policy: DisclosureScope) -> bool {
    use DisclosureScope::*;
    let order = |s: DisclosureScope| match s {
        AggregateOnly => 0u8,
        PerProtocol => 1,
        PerTransaction => 2,
        RecipientList => 3,
        Full => 4,
    };
    order(requested) <= order(policy)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> DisclosurePolicy {
        DisclosurePolicy {
            roles: vec![
                DisclosurePolicyEntry {
                    role: DisclosureRole::PublicAuditor,
                    scope: DisclosureScope::AggregateOnly,
                    time_window: None,
                    max_disclosures_per_window: None,
                    viewing_key_kind: ViewingKeyKind::ElGamal,
                    revocable: true,
                },
                DisclosurePolicyEntry {
                    role: DisclosureRole::FinanceAdmin,
                    scope: DisclosureScope::Full,
                    time_window: None,
                    max_disclosures_per_window: None,
                    viewing_key_kind: ViewingKeyKind::ElGamal,
                    revocable: true,
                },
                DisclosurePolicyEntry {
                    role: DisclosureRole::RegulatorTimeWindowed,
                    scope: DisclosureScope::PerTransaction,
                    time_window: Some((100, 200)),
                    max_disclosures_per_window: Some(50),
                    viewing_key_kind: ViewingKeyKind::AuditorEphemeral,
                    revocable: true,
                },
            ],
            revocation_authority: [9u8; 32],
        }
    }

    #[test]
    fn good_policy_validates() {
        policy().validate().unwrap();
    }

    #[test]
    fn full_scope_only_for_finance_admin() {
        let mut p = policy();
        p.roles[0].scope = DisclosureScope::Full;
        let r = p.validate();
        assert!(matches!(r, Err(DisclosurePolicyError::FullScopeNotForRole(_))));
    }

    #[test]
    fn regulator_without_window_rejects() {
        let mut p = policy();
        p.roles[2].time_window = None;
        let r = p.validate();
        assert!(matches!(r, Err(DisclosurePolicyError::RegulatorMissingWindow)));
    }

    #[test]
    fn duplicate_role_rejects() {
        let mut p = policy();
        p.roles.push(p.roles[0].clone());
        let r = p.validate();
        assert!(matches!(r, Err(DisclosurePolicyError::DuplicateRole(_))));
    }

    #[test]
    fn null_revocation_authority_rejects() {
        let mut p = policy();
        p.revocation_authority = [0u8; 32];
        let r = p.validate();
        assert!(matches!(r, Err(DisclosurePolicyError::NullRevocationAuthority)));
    }

    #[test]
    fn issue_at_or_below_policy_scope_passes() {
        let k = issue_viewing_key(
            [1u8; 32],
            [2u8; 32],
            DisclosureRole::FinanceAdmin,
            DisclosureScope::PerProtocol,
            100,
            &policy(),
        )
        .unwrap();
        assert_eq!(k.scope, DisclosureScope::PerProtocol);
    }

    #[test]
    fn issue_above_policy_scope_rejects() {
        let r = issue_viewing_key(
            [1u8; 32],
            [2u8; 32],
            DisclosureRole::PublicAuditor,
            DisclosureScope::PerTransaction,
            100,
            &policy(),
        );
        assert!(matches!(r, Err(ViewingKeyError::ScopeExceedsPolicy { .. })));
    }

    #[test]
    fn issue_unknown_role_rejects() {
        let r = issue_viewing_key(
            [1u8; 32],
            [2u8; 32],
            DisclosureRole::Operator,
            DisclosureScope::PerProtocol,
            100,
            &policy(),
        );
        assert!(matches!(r, Err(ViewingKeyError::RoleNotInPolicy(_))));
    }

    #[test]
    fn revoked_key_fails_validation() {
        let mut k = issue_viewing_key(
            [1u8; 32],
            [2u8; 32],
            DisclosureRole::PublicAuditor,
            DisclosureScope::AggregateOnly,
            100,
            &policy(),
        )
        .unwrap();
        revoke_viewing_key(&mut k);
        let r = validate_viewing_key(&k, 110);
        assert!(matches!(r, Err(ViewingKeyError::Revoked)));
    }

    #[test]
    fn key_outside_window_fails_validation() {
        let k = issue_viewing_key(
            [1u8; 32],
            [2u8; 32],
            DisclosureRole::RegulatorTimeWindowed,
            DisclosureScope::PerTransaction,
            100,
            &policy(),
        )
        .unwrap();
        let r = validate_viewing_key(&k, 250);
        assert!(matches!(r, Err(ViewingKeyError::OutsideWindow { .. })));
    }

    #[test]
    fn commitment_hash_changes_when_policy_changes() {
        let a = policy().commitment_hash();
        let mut p = policy();
        p.roles[0].scope = DisclosureScope::PerProtocol;
        let b = p.commitment_hash();
        assert_ne!(a, b);
    }
}

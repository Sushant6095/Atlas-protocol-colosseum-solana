//! Compliance posture (directive §10).
//!
//! Atlas remains non-custodial. Dodo handles the regulated rails
//! (KYB, travel-rule, sanctions, AML). Atlas enforces:
//!
//! 1. region restrictions declared in treasury config (route picker
//!    respects them per §7),
//! 2. a pre-flight sanctions check via Dodo's API before scheduling
//!    a settlement,
//! 3. a scoped read role for Dodo's AML integration over the
//!    `payments` and `invoices` warehouse tables.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct RegionPolicy {
    pub permitted: BTreeSet<String>,
    pub forbidden: BTreeSet<String>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum CompliancePolicyError {
    #[error("region `{0}` is in both permitted and forbidden lists; ambiguous")]
    AmbiguousRegion(String),
    #[error("policy declares no permitted regions; settlements would all reject")]
    NoPermittedRegions,
}

impl RegionPolicy {
    pub fn validate(&self) -> Result<(), CompliancePolicyError> {
        if self.permitted.is_empty() {
            return Err(CompliancePolicyError::NoPermittedRegions);
        }
        for region in &self.permitted {
            if self.forbidden.contains(region) {
                return Err(CompliancePolicyError::AmbiguousRegion(region.clone()));
            }
        }
        Ok(())
    }

    /// True iff the region is on the permitted list AND not on the
    /// forbidden list.
    pub fn permits(&self, region: &str) -> bool {
        self.permitted.contains(region) && !self.forbidden.contains(region)
    }
}

/// Pre-flight sanctions check result. Atlas calls Dodo's API before
/// scheduling a settlement; this enum captures the response shape.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SanctionsScreening {
    Clear,
    /// Settlement deferred pending manual review.
    PendingManualReview,
    /// Hard block — Atlas refuses to schedule.
    Blocked,
}

/// Scoped read role for Dodo's AML integration. Atlas exposes the
/// `payments` + `invoices` warehouse tables under this role; nothing
/// else.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AmlReadScope {
    /// Read both tables.
    PaymentsAndInvoices,
    /// Read only payments.
    PaymentsOnly,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AmlReadGrant {
    pub scope: AmlReadScope,
    /// IP allowlist for the Dodo AML caller.
    pub ip_allowlist: BTreeSet<String>,
    /// Token rotation — grants expire and Dodo must re-authenticate.
    pub valid_until_unix: u64,
}

impl AmlReadGrant {
    pub fn covers_table(&self, table: &str) -> bool {
        match self.scope {
            AmlReadScope::PaymentsAndInvoices => matches!(table, "payments" | "invoices"),
            AmlReadScope::PaymentsOnly => table == "payments",
        }
    }

    pub fn is_valid(&self, now_unix: u64) -> bool {
        now_unix < self.valid_until_unix
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ComplianceCheckError {
    #[error("region `{0}` not permitted by treasury policy")]
    RegionForbidden(String),
    #[error("sanctions screening blocked the recipient")]
    SanctionsBlocked,
    #[error("sanctions screening pending; defer until manual review completes")]
    SanctionsPending,
}

/// Run the full compliance pre-flight: region permission + sanctions
/// check. Returns `Ok(())` only when both pass.
pub fn compliance_preflight(
    region: &str,
    policy: &RegionPolicy,
    sanctions: SanctionsScreening,
) -> Result<(), ComplianceCheckError> {
    if !policy.permits(region) {
        return Err(ComplianceCheckError::RegionForbidden(region.to_string()));
    }
    match sanctions {
        SanctionsScreening::Clear => Ok(()),
        SanctionsScreening::PendingManualReview => Err(ComplianceCheckError::SanctionsPending),
        SanctionsScreening::Blocked => Err(ComplianceCheckError::SanctionsBlocked),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy(p: &[&str], f: &[&str]) -> RegionPolicy {
        RegionPolicy {
            permitted: p.iter().map(|s| s.to_string()).collect(),
            forbidden: f.iter().map(|s| s.to_string()).collect(),
        }
    }

    #[test]
    fn permitted_region_passes() {
        let r = compliance_preflight("US", &policy(&["US", "EU"], &["IR"]), SanctionsScreening::Clear);
        assert!(r.is_ok());
    }

    #[test]
    fn forbidden_region_rejects() {
        let r = compliance_preflight("IR", &policy(&["US", "EU"], &["IR"]), SanctionsScreening::Clear);
        assert!(matches!(r, Err(ComplianceCheckError::RegionForbidden(_))));
    }

    #[test]
    fn sanctions_blocked_rejects_even_in_permitted_region() {
        let r = compliance_preflight("US", &policy(&["US"], &[]), SanctionsScreening::Blocked);
        assert!(matches!(r, Err(ComplianceCheckError::SanctionsBlocked)));
    }

    #[test]
    fn sanctions_pending_defers() {
        let r = compliance_preflight("US", &policy(&["US"], &[]), SanctionsScreening::PendingManualReview);
        assert!(matches!(r, Err(ComplianceCheckError::SanctionsPending)));
    }

    #[test]
    fn empty_permitted_list_rejects_at_validation() {
        let p = policy(&[], &["IR"]);
        assert!(matches!(p.validate(), Err(CompliancePolicyError::NoPermittedRegions)));
    }

    #[test]
    fn ambiguous_region_rejects_at_validation() {
        let p = policy(&["US", "IR"], &["IR"]);
        assert!(matches!(p.validate(), Err(CompliancePolicyError::AmbiguousRegion(_))));
    }

    #[test]
    fn aml_grant_scope_check() {
        let g = AmlReadGrant {
            scope: AmlReadScope::PaymentsOnly,
            ip_allowlist: BTreeSet::new(),
            valid_until_unix: 1_700_000_000,
        };
        assert!(g.covers_table("payments"));
        assert!(!g.covers_table("invoices"));
        assert!(!g.covers_table("rebalances"));
    }

    #[test]
    fn aml_grant_expiration_enforced() {
        let g = AmlReadGrant {
            scope: AmlReadScope::PaymentsAndInvoices,
            ip_allowlist: BTreeSet::new(),
            valid_until_unix: 1_700_000_000,
        };
        assert!(g.is_valid(1_700_000_000 - 1));
        assert!(!g.is_valid(1_700_000_001));
    }
}

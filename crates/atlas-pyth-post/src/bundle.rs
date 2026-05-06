//! Bundle layout — Pyth post must be instruction index 0 (directive §8).

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BundleIxKind {
    /// `ComputeBudgetInstruction::set_compute_unit_limit / price` —
    /// these MAY appear before the Pyth post (Solana convention puts
    /// compute budget at the very front). The directive's §8 contract
    /// is read as "first non-compute-budget instruction is the Pyth
    /// post."
    ComputeBudget,
    /// `pyth_receiver::post_update`.
    PythPost,
    /// Atlas's own ixs (verifier read, rebalancer CPIs, record_rb).
    AtlasIx,
    /// Anything else. Allowed in trailing position only when the
    /// orchestrator authorizes — unknown leading ixs reject.
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BundleIxRef {
    pub kind: BundleIxKind,
    /// Optional label for diagnostics.
    pub label: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BundleLayoutError {
    #[error("bundle is empty; expected at least one Pyth post + one Atlas ix")]
    Empty,
    #[error("first non-compute-budget instruction must be PythPost; saw {got:?}")]
    PythPostNotFirst { got: BundleIxKind },
    #[error("Pyth post does not appear anywhere in bundle")]
    PythPostMissing,
    #[error("unknown leading instruction `{label}` ({kind:?}) — only ComputeBudget allowed before PythPost")]
    UnknownLeadingIx { kind: BundleIxKind, label: String },
}

/// Refuse to assemble a bundle whose first non-compute-budget
/// instruction is not the Pyth post, or one that lacks a Pyth post
/// entirely.
pub fn enforce_first_ix(ixs: &[BundleIxRef]) -> Result<(), BundleLayoutError> {
    if ixs.is_empty() {
        return Err(BundleLayoutError::Empty);
    }
    let mut found_pyth = false;
    for ix in ixs {
        match ix.kind {
            BundleIxKind::ComputeBudget => continue,
            BundleIxKind::PythPost => {
                found_pyth = true;
                break;
            }
            BundleIxKind::AtlasIx | BundleIxKind::Other => {
                return Err(BundleLayoutError::PythPostNotFirst { got: ix.kind });
            }
        }
    }
    if !found_pyth {
        return Err(BundleLayoutError::PythPostMissing);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ix(kind: BundleIxKind, label: &str) -> BundleIxRef {
        BundleIxRef { kind, label: label.into() }
    }

    #[test]
    fn pyth_first_is_accepted() {
        let bundle = vec![
            ix(BundleIxKind::PythPost, "post_sol"),
            ix(BundleIxKind::AtlasIx, "verify"),
        ];
        enforce_first_ix(&bundle).unwrap();
    }

    #[test]
    fn compute_budget_then_pyth_is_accepted() {
        let bundle = vec![
            ix(BundleIxKind::ComputeBudget, "set_cu_limit"),
            ix(BundleIxKind::ComputeBudget, "set_cu_price"),
            ix(BundleIxKind::PythPost, "post_sol"),
            ix(BundleIxKind::AtlasIx, "verify"),
        ];
        enforce_first_ix(&bundle).unwrap();
    }

    #[test]
    fn atlas_before_pyth_rejects() {
        let bundle = vec![
            ix(BundleIxKind::AtlasIx, "verify"),
            ix(BundleIxKind::PythPost, "post_sol"),
        ];
        assert!(matches!(
            enforce_first_ix(&bundle),
            Err(BundleLayoutError::PythPostNotFirst { .. })
        ));
    }

    #[test]
    fn missing_pyth_rejects() {
        let bundle = vec![
            ix(BundleIxKind::ComputeBudget, "set_cu_limit"),
            ix(BundleIxKind::AtlasIx, "verify"),
        ];
        assert!(matches!(
            enforce_first_ix(&bundle),
            Err(BundleLayoutError::PythPostNotFirst { .. })
        ));
    }

    #[test]
    fn empty_bundle_rejects() {
        let bundle: Vec<BundleIxRef> = vec![];
        assert!(matches!(enforce_first_ix(&bundle), Err(BundleLayoutError::Empty)));
    }
}

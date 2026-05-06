//! Token-2022 extension manifest + drift detector.
//!
//! Mirrors `spl_token_2022::extension::ExtensionType` so this crate
//! doesn't pull spl-token-2022 into the workspace. Drift is detected
//! by comparing the observed on-chain extension set against the
//! allowed manifest; any forbidden extension or any allowed extension
//! whose policy gate fails (e.g., TransferFeeConfig with `fee_bps > 0`)
//! produces a drift entry.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtensionType {
    TransferFeeConfig,
    InterestBearingConfig,
    MetadataPointer,
    TokenMetadata,
    PermanentDelegate,
    NonTransferable,
    DefaultAccountState,
    TransferHook,
    /// Any other extension — surfaced as drift.
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObservedExtension {
    pub kind: ExtensionType,
    /// Optional policy-gate value. For `TransferFeeConfig`: the
    /// observed `transfer_fee_basis_points`. For
    /// `DefaultAccountState`: 1 if frozen-by-default, 0 otherwise.
    pub policy_value: Option<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtensionDriftKind {
    /// Observed an extension that is not in the allowed set.
    UnauthorizedExtension,
    /// Observed a forbidden extension.
    ForbiddenExtension,
    /// `TransferFeeConfig` with `fee_bps > 0` — accepted only when 0.
    TransferFeeNonZero,
    /// `DefaultAccountState` set to `Frozen` — never allowed.
    FreezeByDefault,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExtensionDrift {
    pub kind: ExtensionDriftKind,
    pub extension: ExtensionType,
    pub policy_value: Option<u32>,
}

/// Compare observed mainnet extensions against allowed/forbidden
/// manifests. Returns one drift row per violation. Empty result =
/// extension set unchanged from policy.
pub fn check_drift(
    observed: &[ObservedExtension],
    allowed: &[ExtensionType],
    forbidden: &[ExtensionType],
) -> Vec<ExtensionDrift> {
    let mut out = Vec::new();
    for o in observed {
        if forbidden.contains(&o.kind) {
            out.push(ExtensionDrift {
                kind: ExtensionDriftKind::ForbiddenExtension,
                extension: o.kind,
                policy_value: o.policy_value,
            });
            continue;
        }
        if !allowed.contains(&o.kind) {
            out.push(ExtensionDrift {
                kind: ExtensionDriftKind::UnauthorizedExtension,
                extension: o.kind,
                policy_value: o.policy_value,
            });
            continue;
        }
        // Per-extension policy gates.
        match o.kind {
            ExtensionType::TransferFeeConfig => {
                if o.policy_value.unwrap_or(0) > 0 {
                    out.push(ExtensionDrift {
                        kind: ExtensionDriftKind::TransferFeeNonZero,
                        extension: o.kind,
                        policy_value: o.policy_value,
                    });
                }
            }
            ExtensionType::DefaultAccountState => {
                // Allowed lists never include this, but if a future policy
                // ever does, freeze-by-default still rejects.
                if o.policy_value.unwrap_or(0) > 0 {
                    out.push(ExtensionDrift {
                        kind: ExtensionDriftKind::FreezeByDefault,
                        extension: o.kind,
                        policy_value: o.policy_value,
                    });
                }
            }
            _ => {}
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn obs(kind: ExtensionType, v: Option<u32>) -> ObservedExtension {
        ObservedExtension { kind, policy_value: v }
    }

    #[test]
    fn allowed_clean_yields_no_drift() {
        let observed = vec![
            obs(ExtensionType::TransferFeeConfig, Some(0)),
            obs(ExtensionType::InterestBearingConfig, None),
            obs(ExtensionType::MetadataPointer, None),
            obs(ExtensionType::TokenMetadata, None),
        ];
        let allowed = &[
            ExtensionType::TransferFeeConfig,
            ExtensionType::InterestBearingConfig,
            ExtensionType::MetadataPointer,
            ExtensionType::TokenMetadata,
        ];
        let forbidden = &[ExtensionType::PermanentDelegate];
        assert!(check_drift(&observed, allowed, forbidden).is_empty());
    }

    #[test]
    fn forbidden_extension_flagged() {
        let observed = vec![obs(ExtensionType::PermanentDelegate, None)];
        let allowed = &[ExtensionType::TransferFeeConfig];
        let forbidden = &[ExtensionType::PermanentDelegate];
        let d = check_drift(&observed, allowed, forbidden);
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].kind, ExtensionDriftKind::ForbiddenExtension);
    }

    #[test]
    fn transfer_fee_non_zero_flagged() {
        let observed = vec![obs(ExtensionType::TransferFeeConfig, Some(50))];
        let allowed = &[ExtensionType::TransferFeeConfig];
        let forbidden: &[ExtensionType] = &[];
        let d = check_drift(&observed, allowed, forbidden);
        assert_eq!(d[0].kind, ExtensionDriftKind::TransferFeeNonZero);
    }

    #[test]
    fn unauthorized_extension_flagged() {
        let observed = vec![obs(ExtensionType::TransferHook, None)];
        let allowed = &[ExtensionType::TransferFeeConfig];
        let forbidden: &[ExtensionType] = &[];
        let d = check_drift(&observed, allowed, forbidden);
        assert_eq!(d[0].kind, ExtensionDriftKind::UnauthorizedExtension);
    }

    #[test]
    fn unknown_extension_flagged_as_unauthorized() {
        let observed = vec![obs(ExtensionType::Other, None)];
        let allowed: &[ExtensionType] = &[];
        let forbidden: &[ExtensionType] = &[];
        let d = check_drift(&observed, allowed, forbidden);
        assert_eq!(d[0].kind, ExtensionDriftKind::UnauthorizedExtension);
    }
}

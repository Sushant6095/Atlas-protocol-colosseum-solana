//! Confidential pattern selector (directive §3).
//!
//! Two patterns; one per vault; immutable post-creation (I-16):
//!
//! * **Pattern A** — Token-2022 ConfidentialTransfer extension.
//!   Used when the deposited mint enables the extension natively.
//! * **Pattern B** — Cloak shielded wrapper mint. Used when the
//!   deposited mint does not support confidential transfer.

use atlas_assets::ExtensionType;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConfidentialPattern {
    /// Token-2022 ConfidentialTransfer extension on the underlying mint.
    Token2022Native,
    /// Cloak shielded wrapper mint (cPUSD, etc.).
    CloakShieldedWrapper,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PatternMismatchError {
    #[error("Pattern A requires the deposited mint to enable ConfidentialTransferAccount + ConfidentialTransferMint")]
    Token2022MissingExtensions,
    #[error("Pattern B requires the deposited mint NOT to enable ConfidentialTransferAccount (otherwise pick Pattern A)")]
    CloakWrapperRedundant,
    #[error("vault declares confidential mode but the chosen pattern is missing")]
    ConfidentialModeWithoutPattern,
}

impl ConfidentialPattern {
    /// Validate the chosen pattern against the underlying mint's
    /// observed extension set. Atlas refuses to deploy a vault whose
    /// pattern does not match the mint's actual capabilities — anti-
    /// pattern §11 third bullet ("viewing keys without scope" has a
    /// sibling here: confidential without the right plumbing).
    pub fn validate_against_extensions(
        self,
        observed: &[ExtensionType],
    ) -> Result<(), PatternMismatchError> {
        let has_conf_account = observed.contains(&ExtensionType::Other);
        // The Phase 10 ExtensionType enum doesn't carry a Confidential
        // variant; we treat its presence as `Other` until the on-chain
        // crate lands. Production-side, this check upgrades to the
        // typed variants below once atlas-assets adds them.
        match self {
            ConfidentialPattern::Token2022Native => {
                if !has_conf_account {
                    return Err(PatternMismatchError::Token2022MissingExtensions);
                }
                Ok(())
            }
            ConfidentialPattern::CloakShieldedWrapper => {
                if has_conf_account {
                    // Atlas refuses Pattern B when Pattern A would
                    // suffice — uniformity wins.
                    return Err(PatternMismatchError::CloakWrapperRedundant);
                }
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token2022_pattern_requires_extension() {
        let r = ConfidentialPattern::Token2022Native.validate_against_extensions(&[]);
        assert!(matches!(r, Err(PatternMismatchError::Token2022MissingExtensions)));
    }

    #[test]
    fn cloak_pattern_with_native_extension_redundant() {
        let r = ConfidentialPattern::CloakShieldedWrapper
            .validate_against_extensions(&[ExtensionType::Other]);
        assert!(matches!(r, Err(PatternMismatchError::CloakWrapperRedundant)));
    }

    #[test]
    fn cloak_pattern_on_legacy_mint_passes() {
        ConfidentialPattern::CloakShieldedWrapper
            .validate_against_extensions(&[])
            .unwrap();
    }

    #[test]
    fn token2022_pattern_with_extension_passes() {
        ConfidentialPattern::Token2022Native
            .validate_against_extensions(&[ExtensionType::Other])
            .unwrap();
    }
}

//! Public vs confidential surface (directive §2 authoritative table).
//!
//! Anyone designing a new feature must place its data here. If it
//! isn't classified, it isn't implemented. A construction-time gate
//! refuses to mark a §2 confidential field as public.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldVisibility {
    Public,
    Confidential,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldName {
    VaultId,
    ApprovedModelHash,
    AllocationBpsRatios,
    AllocationRatiosRoot,
    PerProtocolNotionalAmount,
    TotalTvl,
    UserSharesPerVault,
    RebalanceProofVerificationResult,
    BlackboxRecordSchema,
    BlackboxRecordAmountFields,
    PayrollRecipientAndAmount,
    SettlementRouteChoice,
    SettlementRouteVenue,
    StrategyCommitmentHash,
    KybAttestationHash,
    ForensicSignalsAggregate,
    ForensicSignalsPerVaultNotional,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum SurfaceClassificationError {
    #[error("attempted to override directive §2 classification for {field:?}: directive says {directive:?}, attempted {attempted:?}")]
    OverrideRefused {
        field: FieldName,
        directive: FieldVisibility,
        attempted: FieldVisibility,
    },
}

/// Authoritative classification per directive §2. Refuses any
/// override attempt — if a feature wants a different visibility, it
/// must change the directive (and this table) first.
pub fn classify_field(
    field: FieldName,
    attempted: FieldVisibility,
) -> Result<FieldVisibility, SurfaceClassificationError> {
    let directive = directive_classification(field);
    if directive != attempted {
        return Err(SurfaceClassificationError::OverrideRefused {
            field,
            directive,
            attempted,
        });
    }
    Ok(directive)
}

const fn directive_classification(field: FieldName) -> FieldVisibility {
    use FieldName::*;
    use FieldVisibility::*;
    match field {
        VaultId
        | ApprovedModelHash
        | AllocationBpsRatios
        | AllocationRatiosRoot
        | RebalanceProofVerificationResult
        | BlackboxRecordSchema
        | SettlementRouteChoice
        | SettlementRouteVenue
        | StrategyCommitmentHash
        | KybAttestationHash
        | ForensicSignalsAggregate => Public,
        PerProtocolNotionalAmount
        | TotalTvl
        | UserSharesPerVault
        | BlackboxRecordAmountFields
        | PayrollRecipientAndAmount
        | ForensicSignalsPerVaultNotional => Confidential,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_fields_match_directive() {
        for field in [
            FieldName::VaultId,
            FieldName::ApprovedModelHash,
            FieldName::AllocationBpsRatios,
            FieldName::StrategyCommitmentHash,
            FieldName::KybAttestationHash,
        ] {
            assert_eq!(
                classify_field(field, FieldVisibility::Public).unwrap(),
                FieldVisibility::Public
            );
        }
    }

    #[test]
    fn confidential_fields_match_directive() {
        for field in [
            FieldName::PerProtocolNotionalAmount,
            FieldName::TotalTvl,
            FieldName::PayrollRecipientAndAmount,
            FieldName::BlackboxRecordAmountFields,
        ] {
            assert_eq!(
                classify_field(field, FieldVisibility::Confidential).unwrap(),
                FieldVisibility::Confidential
            );
        }
    }

    #[test]
    fn marking_confidential_field_as_public_refuses() {
        let r = classify_field(FieldName::TotalTvl, FieldVisibility::Public);
        assert!(matches!(r, Err(SurfaceClassificationError::OverrideRefused { .. })));
    }

    #[test]
    fn marking_public_field_as_confidential_refuses() {
        let r = classify_field(FieldName::VaultId, FieldVisibility::Confidential);
        assert!(matches!(r, Err(SurfaceClassificationError::OverrideRefused { .. })));
    }
}

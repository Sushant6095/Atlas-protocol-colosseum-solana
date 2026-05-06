//! Feature schema versioning (directive §2.3).
//!
//! Models declare a `feature_schema_version`. The pipeline's feature
//! extractor verifies the runtime feature schema matches the model's
//! declared version. Mismatch is fatal — no fallback, no auto-migration.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FeatureSchema {
    pub version: u32,
    pub hash: [u8; 32],
    pub fields: Vec<FieldSpec>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FieldSpec {
    pub name: String,
    pub kind: FieldKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldKind {
    PriceQ64,
    LiquidityQ64,
    UtilizationBps,
    BorrowApyBps,
    SupplyApyBps,
    VolBps,
    DepthQ64,
    Custom,
}

impl FeatureSchema {
    /// Hash a schema canonically — used as `feature_schema_hash` in the
    /// model record (§2.1). Field ordering matters; callers must sort
    /// fields by name before hashing.
    pub fn canonical_hash(version: u32, fields: &[FieldSpec]) -> [u8; 32] {
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.feature_schema.v1");
        h.update(&version.to_le_bytes());
        let mut sorted: Vec<&FieldSpec> = fields.iter().collect();
        sorted.sort_by(|a, b| a.name.cmp(&b.name));
        for f in sorted {
            h.update(f.name.as_bytes());
            h.update(&[0u8]); // delimiter
            h.update(&[f.kind as u8]);
        }
        *h.finalize().as_bytes()
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum FeatureSchemaError {
    #[error("schema version mismatch: model expected {expected}, runtime is {actual}")]
    VersionMismatch { expected: u32, actual: u32 },
    #[error("schema hash mismatch: model expected {expected:?}, runtime is {actual:?}")]
    HashMismatch { expected: [u8; 32], actual: [u8; 32] },
}

/// Verify that a runtime feature schema matches a model's declared schema.
/// Both checks (version + hash) are required — same version with different
/// hash means the schema was edited without bumping the version, which is a
/// deployment bug.
pub fn verify_feature_schema(
    model_expected_version: u32,
    model_expected_hash: [u8; 32],
    runtime: &FeatureSchema,
) -> Result<(), FeatureSchemaError> {
    if runtime.version != model_expected_version {
        return Err(FeatureSchemaError::VersionMismatch {
            expected: model_expected_version,
            actual: runtime.version,
        });
    }
    if runtime.hash != model_expected_hash {
        return Err(FeatureSchemaError::HashMismatch {
            expected: model_expected_hash,
            actual: runtime.hash,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn schema(v: u32) -> FeatureSchema {
        let fields = vec![
            FieldSpec { name: "borrow_apy".into(), kind: FieldKind::BorrowApyBps },
            FieldSpec { name: "supply_apy".into(), kind: FieldKind::SupplyApyBps },
            FieldSpec { name: "vol_30m".into(), kind: FieldKind::VolBps },
        ];
        let h = FeatureSchema::canonical_hash(v, &fields);
        FeatureSchema { version: v, hash: h, fields }
    }

    #[test]
    fn canonical_hash_field_order_invariant() {
        let mut a = vec![
            FieldSpec { name: "z".into(), kind: FieldKind::Custom },
            FieldSpec { name: "a".into(), kind: FieldKind::Custom },
        ];
        let mut b = vec![
            FieldSpec { name: "a".into(), kind: FieldKind::Custom },
            FieldSpec { name: "z".into(), kind: FieldKind::Custom },
        ];
        let h1 = FeatureSchema::canonical_hash(1, &a);
        let h2 = FeatureSchema::canonical_hash(1, &b);
        assert_eq!(h1, h2);
        a[0].kind = FieldKind::PriceQ64;
        b[1].kind = FieldKind::PriceQ64; // same change, same canonical position
        let h3 = FeatureSchema::canonical_hash(1, &a);
        let h4 = FeatureSchema::canonical_hash(1, &b);
        assert_eq!(h3, h4);
        assert_ne!(h1, h3);
    }

    #[test]
    fn version_mismatch_rejects() {
        let r = schema(2);
        let err = verify_feature_schema(1, r.hash, &r).unwrap_err();
        assert!(matches!(err, FeatureSchemaError::VersionMismatch { .. }));
    }

    #[test]
    fn hash_mismatch_rejects() {
        let r = schema(1);
        let err = verify_feature_schema(1, [0u8; 32], &r).unwrap_err();
        assert!(matches!(err, FeatureSchemaError::HashMismatch { .. }));
    }

    #[test]
    fn matching_schema_passes() {
        let r = schema(7);
        verify_feature_schema(7, r.hash, &r).unwrap();
    }
}

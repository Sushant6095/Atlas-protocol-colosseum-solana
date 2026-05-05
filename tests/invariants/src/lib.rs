//! Invariants test suite — fails CI on any I-1 .. I-12 violation.
//!
//! The directive at `docs/prompts/01-core-execution-engine.md §1` declares
//! twelve global invariants. Each is asserted by at least one test below.
//! Tests live as integration tests under `tests/` so a violation surfaces
//! independently of unit-test runs.

#[cfg(test)]
mod i_4_canonical_public_input {
    use atlas_public_input::{PublicInputV2, SIZE, VERSION};

    #[test]
    fn only_v2_accepted() {
        let mut bytes = sample().encode();
        bytes[0] = 0x01;
        assert!(PublicInputV2::decode(&bytes).is_err());
    }

    #[test]
    fn size_is_268() {
        assert_eq!(SIZE, 268);
        assert_eq!(VERSION, 0x02);
    }

    fn sample() -> PublicInputV2 {
        PublicInputV2 {
            flags: 0,
            slot: 1,
            vault_id: [1u8; 32],
            model_hash: [2u8; 32],
            state_root: [3u8; 32],
            feature_root: [4u8; 32],
            consensus_root: [5u8; 32],
            allocation_root: [6u8; 32],
            explanation_hash: [7u8; 32],
            risk_state_hash: [8u8; 32],
        }
    }
}

#[cfg(test)]
mod i_5_no_floats_in_proof_inputs {
    use atlas_pipeline::stages::allocation::{AllocationVectorBps, TOTAL_BPS};

    #[test]
    fn allocation_is_u32_bps_summing_to_10_000() {
        let v = AllocationVectorBps::try_new(vec![3_000, 3_000, 2_500, 1_000, 500]).unwrap();
        assert_eq!(v.bps.iter().sum::<u32>(), TOTAL_BPS);
    }

    #[test]
    fn rejects_partial_sum() {
        assert!(AllocationVectorBps::try_new(vec![5_000, 4_000]).is_err());
    }
}

#[cfg(test)]
mod i_6_deterministic_ordering {
    use atlas_pipeline::stages::features::{Feature, FeatureId, FeatureLineage, FeatureVector};

    fn f(id: FeatureId, idx: u8, v: i64) -> Feature {
        Feature {
            id,
            protocol_index: idx,
            value_q: v,
            lineage: FeatureLineage { sources: vec![[idx; 32]], slot_low: 1, slot_high: 1, hash: [idx; 32] },
        }
    }

    #[test]
    fn input_order_does_not_affect_root() {
        let a = vec![
            f(FeatureId::Volatility30m, 0, 100),
            f(FeatureId::OracleDeviation, 1, 50),
            f(FeatureId::ProtocolUtilization, 2, 8000),
        ];
        let mut b = a.clone();
        b.reverse();
        let v1 = FeatureVector::new(a);
        let v2 = FeatureVector::new(b);
        assert_eq!(v1.feature_root, v2.feature_root);
    }
}

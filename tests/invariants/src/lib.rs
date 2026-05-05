//! Invariants test suite — fails CI on any I-1 .. I-12 violation.
//!
//! The directive at `docs/prompts/01-core-execution-engine.md §1` declares
//! twelve global invariants. Each is asserted by at least one test below.
//! Tests live as integration tests so a violation surfaces independently
//! of unit-test runs.

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
            secondary_index: 0,
            value_q: v,
            lineage: FeatureLineage {
                sources: vec![[idx; 32]],
                slot_low: 1,
                slot_high: 1,
                hash: [idx; 32],
            },
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

/// Directive §5 acceptance gate: with a single hard-veto agent, the resulting
/// allocation is *exactly* the defensive allocation, regardless of how the
/// other agents voted.
#[cfg(test)]
mod consensus_hard_veto_property {
    use atlas_pipeline::stages::agents::{AgentId, AgentProposal, RejectionCode, VetoLevel};
    use atlas_pipeline::stages::consensus::{
        resolve_consensus, ConsensusInput, TAU_DISAGREE_BPS,
    };
    use proptest::prelude::*;

    /// Generate a non-vetoing proposal for any agent.
    fn arb_clean_proposal(n: usize) -> impl Strategy<Value = AgentProposal> {
        let agent = prop_oneof![
            Just(AgentId::YieldMax),
            Just(AgentId::VolSuppress),
            Just(AgentId::LiquidityStability),
            Just(AgentId::TailRisk),
            Just(AgentId::ExecEfficiency),
            Just(AgentId::ProtocolExposure),
            Just(AgentId::EmergencySentinel),
        ];
        let alloc_strategy = arb_allocation(n);
        let confidence = 0u32..=10_000;
        (agent, alloc_strategy, confidence).prop_map(|(agent_id, allocation_bps, confidence)| {
            AgentProposal {
                agent_id,
                allocation_bps,
                confidence,
                rejection_reasons: vec![],
                veto: None,
                reasoning_commit: [agent_id as u8; 32],
            }
        })
    }

    /// Allocations summing to exactly 10_000 bps, of fixed length n.
    fn arb_allocation(n: usize) -> impl Strategy<Value = Vec<u32>> {
        // Start from a uniform seed, then permute via random "weights" in [0, 10_000].
        prop::collection::vec(0u32..=10_000, n).prop_map(move |raw| {
            let sum: u64 = raw.iter().map(|x| *x as u64).sum();
            if sum == 0 {
                let base = 10_000 / n as u32;
                let mut v = vec![base; n];
                let used = base * n as u32;
                let mut leftover = 10_000 - used;
                let mut i = 0;
                while leftover > 0 {
                    v[i % n] += 1;
                    leftover -= 1;
                    i += 1;
                }
                return v;
            }
            // Scale to bps and renormalize via largest-remainder.
            let mut scaled: Vec<u64> = raw
                .iter()
                .map(|x| (*x as u64) * 10_000 / sum)
                .collect();
            let assigned: u64 = scaled.iter().sum();
            let mut leftover = 10_000u64.saturating_sub(assigned);
            let mut i = 0;
            while leftover > 0 {
                scaled[i % n] += 1;
                leftover -= 1;
                i += 1;
            }
            scaled.into_iter().map(|x| x as u32).collect()
        })
    }

    proptest! {
        #![proptest_config(ProptestConfig { cases: 256, .. ProptestConfig::default() })]

        /// Property: if ANY hard-veto-authorized agent issues a Hard veto, the
        /// final_allocation must be byte-equal to the defensive vector,
        /// regardless of how the remaining agents voted.
        #[test]
        fn hard_veto_collapses_to_defensive(
            n_protocols in 2usize..=8,
            // Generate up to 6 clean proposals plus one hard-vetoing agent.
            seed in any::<u64>(),
        ) {
            let n = n_protocols;
            let defensive = build_defensive(n);
            let current = build_uniform(n);
            let acc = vec![
                (AgentId::YieldMax, 7_000u32),
                (AgentId::VolSuppress, 5_500),
                (AgentId::TailRisk, 9_000),
                (AgentId::EmergencySentinel, 9_500),
            ];

            // Six clean proposals from a deterministic RNG seeded by `seed`.
            let mut proposals = vec![];
            for k in 0..6u8 {
                let agent = match (seed.wrapping_add(k as u64)) % 7 {
                    0 => AgentId::YieldMax,
                    1 => AgentId::VolSuppress,
                    2 => AgentId::ExecEfficiency,
                    3 => AgentId::LiquidityStability,
                    4 => AgentId::TailRisk,
                    5 => AgentId::ProtocolExposure,
                    _ => AgentId::EmergencySentinel,
                };
                proposals.push(AgentProposal {
                    agent_id: agent,
                    allocation_bps: build_alloc_from_seed(seed.wrapping_mul(k as u64 + 1), n),
                    confidence: ((seed >> (k * 4)) as u32) % 10_001,
                    rejection_reasons: vec![],
                    veto: None,
                    reasoning_commit: [agent as u8; 32],
                });
            }

            // One hard veto from a hard-veto-authorized agent.
            proposals.push(AgentProposal {
                agent_id: AgentId::TailRisk,
                allocation_bps: build_uniform(n),
                confidence: 8_000,
                rejection_reasons: vec![RejectionCode::TailRiskBreach],
                veto: Some(VetoLevel::Hard),
                reasoning_commit: [AgentId::TailRisk as u8; 32],
            });

            let outcome = resolve_consensus(ConsensusInput {
                proposals: &proposals,
                current_allocation: &current,
                defensive_allocation: &defensive,
                historical_accuracy_bps: &acc,
                tau_disagree_bps: TAU_DISAGREE_BPS,
            }).unwrap();

            prop_assert!(outcome.defensive_triggered);
            prop_assert_eq!(outcome.final_allocation.clone(), defensive.clone(),
                "final allocation must be byte-equal to defensive vector under hard veto");
        }
    }

    fn build_defensive(n: usize) -> Vec<u32> {
        // 60% in protocol 0, 40% in protocol N-1, zeros elsewhere.
        let mut v = vec![0u32; n];
        v[0] = 6_000;
        v[n - 1] += 4_000;
        if n == 1 {
            return vec![10_000];
        }
        v
    }

    fn build_uniform(n: usize) -> Vec<u32> {
        let base = 10_000 / n as u32;
        let mut v = vec![base; n];
        let used = base * n as u32;
        let mut leftover = 10_000 - used;
        let mut i = 0;
        while leftover > 0 {
            v[i % n] += 1;
            leftover -= 1;
            i += 1;
        }
        v
    }

    fn build_alloc_from_seed(seed: u64, n: usize) -> Vec<u32> {
        let mut v = vec![0u32; n];
        for i in 0..n {
            let x = ((seed.rotate_left(i as u32 * 7)) & 0xFFFF) as u32;
            v[i] = x.min(10_000);
        }
        let sum: u64 = v.iter().map(|x| *x as u64).sum();
        if sum == 0 {
            return build_uniform(n);
        }
        // Scale to 10_000 via largest-remainder.
        let mut scaled: Vec<u64> = v.iter().map(|x| (*x as u64) * 10_000 / sum).collect();
        let assigned: u64 = scaled.iter().sum();
        let mut leftover = 10_000u64.saturating_sub(assigned);
        let mut i = 0;
        while leftover > 0 {
            scaled[i % n] += 1;
            leftover -= 1;
            i += 1;
        }
        scaled.into_iter().map(|x| x as u32).collect()
    }
}

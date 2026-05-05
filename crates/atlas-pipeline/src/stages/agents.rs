//! Stage 05 — EvaluateAgents.
//!
//! Heterogeneous 7-agent ensemble. Each agent produces an `AgentProposal`
//! independently. The ensemble is committed via a Merkle root over the
//! per-agent reasoning commits and per-agent model hashes — the latter
//! becomes `model_hash = ensemble_root` in the public input v2 layout.
//!
//! Veto authority (directive §5):
//!   YieldMax           — none
//!   VolSuppress        — soft
//!   LiquidityStability — hard
//!   TailRisk           — hard
//!   ExecEfficiency     — soft
//!   ProtocolExposure   — hard
//!   EmergencySentinel  — hard

use crate::hashing::{hash_with_tag, merkle_with_tag, tags};

/// Stable u8 discriminants — wire format is part of the commitment, never reorder.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(u8)]
pub enum AgentId {
    YieldMax = 0,
    VolSuppress = 1,
    LiquidityStability = 2,
    TailRisk = 3,
    ExecEfficiency = 4,
    ProtocolExposure = 5,
    EmergencySentinel = 6,
}

impl AgentId {
    /// Whether this agent is permitted to issue a hard veto. Hard veto from
    /// any of these agents collapses the rebalance to the defensive vector.
    pub fn allows_hard_veto(self) -> bool {
        matches!(
            self,
            AgentId::LiquidityStability
                | AgentId::TailRisk
                | AgentId::ProtocolExposure
                | AgentId::EmergencySentinel
        )
    }

    pub fn allows_soft_veto(self) -> bool {
        matches!(
            self,
            AgentId::VolSuppress
                | AgentId::ExecEfficiency
                | AgentId::LiquidityStability
                | AgentId::TailRisk
                | AgentId::ProtocolExposure
                | AgentId::EmergencySentinel
        )
    }

    pub fn all() -> [AgentId; 7] {
        [
            AgentId::YieldMax,
            AgentId::VolSuppress,
            AgentId::LiquidityStability,
            AgentId::TailRisk,
            AgentId::ExecEfficiency,
            AgentId::ProtocolExposure,
            AgentId::EmergencySentinel,
        ]
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum VetoLevel {
    Soft = 1,
    Hard = 2,
}

/// Stable u16 discriminants — wire format is committed via reasoning_commit.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u16)]
pub enum RejectionCode {
    InsufficientLiquidity = 0x0001,
    OracleStale = 0x0002,
    ConcentrationCap = 0x0003,
    UtilizationCap = 0x0004,
    VolatilityRegime = 0x0005,
    TailRiskBreach = 0x0006,
    SlippageExceeded = 0x0007,
    CuBudgetExceeded = 0x0008,
    RegimeCrisis = 0x0009,
    ProtocolBlocklisted = 0x000A,
    Token2022Banned = 0x000B,
}

#[derive(Clone, Debug)]
pub struct AgentProposal {
    pub agent_id: AgentId,
    pub allocation_bps: Vec<u32>,
    pub confidence: u32, // 0..=10_000
    pub rejection_reasons: Vec<RejectionCode>,
    pub veto: Option<VetoLevel>,
    pub reasoning_commit: [u8; 32],
}

impl AgentProposal {
    /// Validate the proposal's basic shape before consensus.
    pub fn validate(&self, expected_n: usize) -> Result<(), &'static str> {
        if self.allocation_bps.len() != expected_n {
            return Err("allocation length mismatch");
        }
        if self.confidence > 10_000 {
            return Err("confidence > 10_000 bps");
        }
        let sum: u64 = self.allocation_bps.iter().map(|x| *x as u64).sum();
        if sum != 10_000 {
            return Err("allocation must sum to 10_000 bps");
        }
        if let Some(VetoLevel::Hard) = self.veto {
            if !self.agent_id.allows_hard_veto() {
                return Err("agent not authorized to issue hard veto");
            }
        }
        if let Some(VetoLevel::Soft) = self.veto {
            if !self.agent_id.allows_soft_veto() {
                return Err("agent not authorized to issue soft veto");
            }
        }
        Ok(())
    }

    /// Canonical commitment over the proposal contents. Goes into the
    /// consensus root.
    pub fn proposal_commit(&self) -> [u8; 32] {
        let alloc_le: Vec<[u8; 4]> =
            self.allocation_bps.iter().map(|x| x.to_le_bytes()).collect();
        let alloc_refs: Vec<&[u8]> = alloc_le.iter().map(|b| b.as_slice()).collect();
        let alloc_root = hash_with_tag(tags::ALLOC_V2, &alloc_refs);

        let veto_byte = match self.veto {
            None => 0u8,
            Some(VetoLevel::Soft) => 1u8,
            Some(VetoLevel::Hard) => 2u8,
        };

        let mut rejection_le: Vec<[u8; 2]> =
            self.rejection_reasons.iter().map(|r| (*r as u16).to_le_bytes()).collect();
        rejection_le.sort();
        rejection_le.dedup();
        let rej_refs: Vec<&[u8]> = rejection_le.iter().map(|b| b.as_slice()).collect();

        let mut all_inputs: Vec<&[u8]> = Vec::new();
        let agent_byte = [self.agent_id as u8];
        let confidence_le = self.confidence.to_le_bytes();
        let veto = [veto_byte];
        all_inputs.push(&agent_byte);
        all_inputs.push(&confidence_le);
        all_inputs.push(&veto);
        all_inputs.push(&alloc_root);
        all_inputs.push(&self.reasoning_commit);
        for r in &rej_refs {
            all_inputs.push(r);
        }
        hash_with_tag(tags::CONSENSUS_V2, &all_inputs)
    }
}

/// Build the ensemble model hash that goes into `public_input.model_hash`.
/// Order: by `AgentId` u8 discriminant. Missing agents → caller must
/// provide a sentinel hash; we never silently substitute defaults (I-7).
pub fn ensemble_root(per_agent_model_hashes: &[(AgentId, [u8; 32])]) -> [u8; 32] {
    let mut sorted: Vec<(AgentId, [u8; 32])> = per_agent_model_hashes.to_vec();
    sorted.sort_by_key(|(a, _)| *a as u8);
    let leaves: Vec<[u8; 32]> = sorted.iter().map(|(_, h)| *h).collect();
    merkle_with_tag(tags::ENSEMBLE_V2, &leaves)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn proposal(id: AgentId, conf: u32, alloc: Vec<u32>, veto: Option<VetoLevel>) -> AgentProposal {
        AgentProposal {
            agent_id: id,
            allocation_bps: alloc,
            confidence: conf,
            rejection_reasons: vec![],
            veto,
            reasoning_commit: [id as u8; 32],
        }
    }

    #[test]
    fn validate_rejects_unauthorized_hard_veto() {
        let p = proposal(AgentId::YieldMax, 5_000, vec![10_000, 0], Some(VetoLevel::Hard));
        assert!(p.validate(2).is_err());
    }

    #[test]
    fn validate_accepts_authorized_hard_veto() {
        let p = proposal(AgentId::TailRisk, 5_000, vec![10_000, 0], Some(VetoLevel::Hard));
        assert!(p.validate(2).is_ok());
    }

    #[test]
    fn validate_rejects_bad_sum() {
        let p = proposal(AgentId::YieldMax, 5_000, vec![6_000, 3_000], None);
        assert!(p.validate(2).is_err());
    }

    #[test]
    fn proposal_commit_deterministic() {
        let p1 = proposal(AgentId::YieldMax, 8_000, vec![5_000, 5_000], None);
        let p2 = proposal(AgentId::YieldMax, 8_000, vec![5_000, 5_000], None);
        assert_eq!(p1.proposal_commit(), p2.proposal_commit());
    }

    #[test]
    fn proposal_commit_changes_on_alloc_diff() {
        let p1 = proposal(AgentId::YieldMax, 8_000, vec![5_000, 5_000], None);
        let p2 = proposal(AgentId::YieldMax, 8_000, vec![6_000, 4_000], None);
        assert_ne!(p1.proposal_commit(), p2.proposal_commit());
    }

    #[test]
    fn ensemble_root_order_invariant() {
        let a = vec![
            (AgentId::YieldMax, [1u8; 32]),
            (AgentId::TailRisk, [2u8; 32]),
            (AgentId::EmergencySentinel, [3u8; 32]),
        ];
        let mut b = a.clone();
        b.reverse();
        assert_eq!(ensemble_root(&a), ensemble_root(&b));
    }
}

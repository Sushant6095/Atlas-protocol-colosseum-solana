//! Per-vault `execution_privacy` declaration (directive I-24 + I-25).
//!
//! A vault declares its execution privacy at creation time. The
//! choice is part of the strategy commitment hash; no mid-life flip.
//! `PrivateER` requires a disclosure policy that covers an
//! `ExecutionPath*` scope (I-25 enforcement).

use atlas_confidential::disclosure::{DisclosurePolicy, DisclosureScope};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// Default upper bound on session lifetime. The gateway enforces
/// this; sessions exceeding the bound are auto-undelegated. 256 slots
/// ≈ 102s on mainnet — long enough for a rebalance, short enough
/// that the safety net kicks in before the rollup operator can
/// indefinitely lock funds.
pub const MAX_PER_SESSION_SLOTS: u64 = 256;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum ExecutionPrivacy {
    /// Plain mainnet execution. Phase 01 default.
    Mainnet,
    /// Private Ephemeral Rollup execution. The vault delegates to
    /// the named MagicBlock program and settles back within
    /// `max_session_slots`.
    PrivateEr {
        magicblock_program: Pubkey,
        max_session_slots: u64,
    },
}

impl ExecutionPrivacy {
    pub fn is_private(self) -> bool {
        matches!(self, ExecutionPrivacy::PrivateEr { .. })
    }

    /// Domain-tagged commitment over the privacy choice. Folds into
    /// the vault's strategy commitment so I-24 (no mid-life flip)
    /// is enforced by the same hash that pins the model id and the
    /// disclosure policy.
    pub fn commitment_hash(self) -> [u8; 32] {
        let mut h = blake3::Hasher::new();
        h.update(b"atlas.execution_privacy.v1");
        match self {
            ExecutionPrivacy::Mainnet => {
                h.update(&[0u8]);
            }
            ExecutionPrivacy::PrivateEr {
                magicblock_program,
                max_session_slots,
            } => {
                h.update(&[1u8]);
                h.update(&magicblock_program);
                h.update(&max_session_slots.to_le_bytes());
            }
        }
        *h.finalize().as_bytes()
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ExecutionPrivacyError {
    #[error(
        "PrivateER vault has no DisclosurePolicy scope covering execution paths \
         (I-25): need ExecutionPathPostHoc / ExecutionPathRealtime / AgentTraceOnly"
    )]
    PrivateErWithoutExecutionPathScope,
    #[error("PrivateER max_session_slots ({0}) exceeds the gateway cap ({1})")]
    SessionSlotsAboveCap(u64, u64),
    #[error("PrivateER magicblock_program is the zero pubkey")]
    NullMagicBlockProgram,
    #[error("PrivateER max_session_slots is zero — sessions would always be expired")]
    ZeroSessionSlots,
}

/// I-25 enforcement. Returns Ok iff the policy + privacy pair is
/// admissible at vault-create time. CI invariant tests call this on
/// every vault deployment manifest before `cargo build` succeeds.
pub fn require_execution_path_scope(
    privacy: ExecutionPrivacy,
    policy: Option<&DisclosurePolicy>,
) -> Result<(), ExecutionPrivacyError> {
    match privacy {
        ExecutionPrivacy::Mainnet => Ok(()),
        ExecutionPrivacy::PrivateEr {
            magicblock_program,
            max_session_slots,
        } => {
            if magicblock_program == [0u8; 32] {
                return Err(ExecutionPrivacyError::NullMagicBlockProgram);
            }
            if max_session_slots == 0 {
                return Err(ExecutionPrivacyError::ZeroSessionSlots);
            }
            if max_session_slots > MAX_PER_SESSION_SLOTS {
                return Err(ExecutionPrivacyError::SessionSlotsAboveCap(
                    max_session_slots,
                    MAX_PER_SESSION_SLOTS,
                ));
            }
            let p = policy.ok_or(ExecutionPrivacyError::PrivateErWithoutExecutionPathScope)?;
            let any_execution_scope = p.roles.iter().any(|r| {
                matches!(
                    r.scope,
                    DisclosureScope::ExecutionPathPostHoc
                        | DisclosureScope::ExecutionPathRealtime
                        | DisclosureScope::AgentTraceOnly,
                )
            });
            if !any_execution_scope {
                return Err(ExecutionPrivacyError::PrivateErWithoutExecutionPathScope);
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atlas_confidential::disclosure::{
        DisclosurePolicyEntry, DisclosureRole, ViewingKeyKind,
    };

    fn policy_with(scope: DisclosureScope, role: DisclosureRole) -> DisclosurePolicy {
        DisclosurePolicy {
            roles: vec![DisclosurePolicyEntry {
                role,
                scope,
                time_window: None,
                max_disclosures_per_window: None,
                viewing_key_kind: ViewingKeyKind::AuditorEphemeral,
                revocable: true,
            }],
            revocation_authority: [9u8; 32],
        }
    }

    #[test]
    fn mainnet_privacy_needs_no_execution_scope() {
        require_execution_path_scope(ExecutionPrivacy::Mainnet, None).unwrap();
    }

    #[test]
    fn private_er_without_policy_rejected() {
        let r = require_execution_path_scope(
            ExecutionPrivacy::PrivateEr {
                magicblock_program: [3u8; 32],
                max_session_slots: 200,
            },
            None,
        );
        assert!(matches!(r, Err(ExecutionPrivacyError::PrivateErWithoutExecutionPathScope)));
    }

    #[test]
    fn private_er_without_execution_path_scope_rejected() {
        let p = policy_with(DisclosureScope::AggregateOnly, DisclosureRole::PublicAuditor);
        let r = require_execution_path_scope(
            ExecutionPrivacy::PrivateEr {
                magicblock_program: [3u8; 32],
                max_session_slots: 200,
            },
            Some(&p),
        );
        assert!(matches!(r, Err(ExecutionPrivacyError::PrivateErWithoutExecutionPathScope)));
    }

    #[test]
    fn private_er_with_post_hoc_scope_accepted() {
        let p = policy_with(
            DisclosureScope::ExecutionPathPostHoc,
            DisclosureRole::PublicAuditor,
        );
        require_execution_path_scope(
            ExecutionPrivacy::PrivateEr {
                magicblock_program: [3u8; 32],
                max_session_slots: 200,
            },
            Some(&p),
        )
        .unwrap();
    }

    #[test]
    fn null_magicblock_program_rejected() {
        let p = policy_with(
            DisclosureScope::ExecutionPathPostHoc,
            DisclosureRole::PublicAuditor,
        );
        let r = require_execution_path_scope(
            ExecutionPrivacy::PrivateEr {
                magicblock_program: [0u8; 32],
                max_session_slots: 200,
            },
            Some(&p),
        );
        assert!(matches!(r, Err(ExecutionPrivacyError::NullMagicBlockProgram)));
    }

    #[test]
    fn session_slots_above_cap_rejected() {
        let p = policy_with(
            DisclosureScope::ExecutionPathRealtime,
            DisclosureRole::RegulatorTimeWindowed,
        );
        let r = require_execution_path_scope(
            ExecutionPrivacy::PrivateEr {
                magicblock_program: [3u8; 32],
                max_session_slots: MAX_PER_SESSION_SLOTS + 1,
            },
            Some(&p),
        );
        assert!(matches!(r, Err(ExecutionPrivacyError::SessionSlotsAboveCap(_, _))));
    }

    #[test]
    fn zero_session_slots_rejected() {
        let p = policy_with(
            DisclosureScope::ExecutionPathPostHoc,
            DisclosureRole::PublicAuditor,
        );
        let r = require_execution_path_scope(
            ExecutionPrivacy::PrivateEr {
                magicblock_program: [3u8; 32],
                max_session_slots: 0,
            },
            Some(&p),
        );
        assert!(matches!(r, Err(ExecutionPrivacyError::ZeroSessionSlots)));
    }

    #[test]
    fn commitment_hash_distinguishes_mainnet_vs_private() {
        let a = ExecutionPrivacy::Mainnet.commitment_hash();
        let b = ExecutionPrivacy::PrivateEr {
            magicblock_program: [3u8; 32],
            max_session_slots: 200,
        }
        .commitment_hash();
        assert_ne!(a, b);
    }

    #[test]
    fn commitment_hash_distinguishes_max_session_slots() {
        let a = ExecutionPrivacy::PrivateEr {
            magicblock_program: [3u8; 32],
            max_session_slots: 200,
        }
        .commitment_hash();
        let b = ExecutionPrivacy::PrivateEr {
            magicblock_program: [3u8; 32],
            max_session_slots: 256,
        }
        .commitment_hash();
        assert_ne!(a, b);
    }

    #[test]
    fn agent_trace_only_scope_satisfies_i25() {
        let p = policy_with(DisclosureScope::AgentTraceOnly, DisclosureRole::Operator);
        require_execution_path_scope(
            ExecutionPrivacy::PrivateEr {
                magicblock_program: [3u8; 32],
                max_session_slots: 200,
            },
            Some(&p),
        )
        .unwrap();
    }
}

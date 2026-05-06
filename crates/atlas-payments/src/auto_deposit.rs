//! Invoice → vault auto-deposit flow (directive §6.2 third bullet).
//!
//! When Dodo settles an invoice into the business's stablecoin
//! balance, Atlas auto-deposits the proceeds into the vault under
//! the role's auto-deposit cap signed off at creation. Auto-deposit
//! is a deliberate signed policy, not a default (anti-pattern §13).

use crate::business::{BusinessTreasury, Role};
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

/// Per-role auto-deposit policy declared at vault creation. Anything
/// above the role's cap defers to the multisig.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AutoDepositPolicy {
    pub role: Role,
    pub auto_deposit_cap_q64: u128,
    pub daily_auto_deposit_cap_q64: u128,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceSettledEvent {
    pub invoice_id: String,
    pub treasury_id: Pubkey,
    pub amount_q64: u128,
    pub mint: String,
    pub settled_at_slot: u64,
    /// Signing role under which the auto-deposit policy was created.
    pub policy_role: Role,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutoDepositDecision {
    /// Auto-deposit fits the per-role and daily caps. The deposit ix
    /// is queued for the next pipeline run.
    Auto,
    /// Above per-role cap or daily cap; multisig signs.
    QueueMultisig { reason: AutoDepositDeferralReason },
    /// No matching role policy at all — refuses to act.
    NoPolicy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AutoDepositDeferralReason {
    AbovePerInvoiceCap,
    AboveDailyCap,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AutoDepositError {
    #[error("treasury policy mismatch: event treasury_id {got:?} != roster treasury")]
    TreasuryMismatch { got: Pubkey },
    #[error("zero-amount settled event rejected")]
    ZeroAmount,
}

/// Decide whether to auto-deposit. Returns the deferral reason when
/// the deposit must go through multisig.
pub fn decide_auto_deposit(
    business: &BusinessTreasury,
    policy: &AutoDepositPolicy,
    event: &InvoiceSettledEvent,
    spent_today_q64: u128,
) -> Result<AutoDepositDecision, AutoDepositError> {
    if event.amount_q64 == 0 {
        return Err(AutoDepositError::ZeroAmount);
    }
    if event.treasury_id != business.inner.entity_id {
        return Err(AutoDepositError::TreasuryMismatch { got: event.treasury_id });
    }
    if event.policy_role != policy.role {
        return Ok(AutoDepositDecision::NoPolicy);
    }
    if event.amount_q64 > policy.auto_deposit_cap_q64 {
        return Ok(AutoDepositDecision::QueueMultisig {
            reason: AutoDepositDeferralReason::AbovePerInvoiceCap,
        });
    }
    if spent_today_q64.saturating_add(event.amount_q64) > policy.daily_auto_deposit_cap_q64 {
        return Ok(AutoDepositDecision::QueueMultisig {
            reason: AutoDepositDeferralReason::AboveDailyCap,
        });
    }
    Ok(AutoDepositDecision::Auto)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::business::{BusinessKind, SignerRoster, SignerRosterEntry};
    use crate::kyb::{KybAttestation, KybProviderId};
    use atlas_failure::class::ProtocolId;
    use atlas_governance::SignerSet;
    use atlas_treasury::{TreasuryEntity, TreasuryRiskPolicy};

    fn business() -> BusinessTreasury {
        let policy = TreasuryRiskPolicy {
            max_exposure_per_protocol_bps: 5_000,
            approved_protocols: vec![ProtocolId(1)],
            min_idle_buffer_bps: 2_000,
            max_drawdown_bps_24h: 500,
            max_oracle_deviation_bps: 100,
            pause_signers_required: 2,
            rebalance_cooldown_slots: 9_000,
            emergency_recipient: [9u8; 32],
        };
        let board = SignerSet::new([[1u8; 32], [2u8; 32], [3u8; 32]], 2).unwrap();
        let inner = TreasuryEntity::new([0xab; 32], vec![[7u8; 32]], policy, board).unwrap();
        BusinessTreasury::new(
            inner,
            BusinessKind {
                legal_name: "Acme".into(),
                kyb: KybAttestation {
                    provider: KybProviderId::Dodo,
                    payload_uri: "s3://kyb".into(),
                    attestation_hash: [0u8; 32],
                    provider_signer: [9u8; 32],
                },
                payment_account_id: "dodo_acct".into(),
                roster: SignerRoster {
                    entries: vec![SignerRosterEntry {
                        pubkey: [1u8; 32],
                        role: Role::Cfo,
                        single_payout_cap_q64: 50_000,
                        daily_payout_cap_q64: 500_000,
                        cooldown_slots: 0,
                    }],
                    quorum_for_above_cap: 1,
                },
            },
        )
        .unwrap()
    }

    fn policy() -> AutoDepositPolicy {
        AutoDepositPolicy {
            role: Role::Cfo,
            auto_deposit_cap_q64: 10_000,
            daily_auto_deposit_cap_q64: 50_000,
        }
    }

    fn event(amount: u128) -> InvoiceSettledEvent {
        InvoiceSettledEvent {
            invoice_id: "inv_1".into(),
            treasury_id: business().inner.entity_id,
            amount_q64: amount,
            mint: "USDC".into(),
            settled_at_slot: 100,
            policy_role: Role::Cfo,
        }
    }

    #[test]
    fn under_caps_auto_deposits() {
        let d = decide_auto_deposit(&business(), &policy(), &event(5_000), 0).unwrap();
        assert_eq!(d, AutoDepositDecision::Auto);
    }

    #[test]
    fn above_per_invoice_cap_queues_multisig() {
        let d = decide_auto_deposit(&business(), &policy(), &event(20_000), 0).unwrap();
        assert!(matches!(
            d,
            AutoDepositDecision::QueueMultisig {
                reason: AutoDepositDeferralReason::AbovePerInvoiceCap
            }
        ));
    }

    #[test]
    fn above_daily_cap_queues_multisig() {
        let d = decide_auto_deposit(&business(), &policy(), &event(5_000), 48_000).unwrap();
        assert!(matches!(
            d,
            AutoDepositDecision::QueueMultisig {
                reason: AutoDepositDeferralReason::AboveDailyCap
            }
        ));
    }

    #[test]
    fn unmatched_role_yields_no_policy() {
        let mut e = event(5_000);
        e.policy_role = Role::Operator;
        let d = decide_auto_deposit(&business(), &policy(), &e, 0).unwrap();
        assert_eq!(d, AutoDepositDecision::NoPolicy);
    }

    #[test]
    fn wrong_treasury_rejects() {
        let mut e = event(5_000);
        e.treasury_id = [0xff; 32];
        let r = decide_auto_deposit(&business(), &policy(), &e, 0);
        assert!(matches!(r, Err(AutoDepositError::TreasuryMismatch { .. })));
    }

    #[test]
    fn zero_amount_rejects() {
        let r = decide_auto_deposit(&business(), &policy(), &event(0), 0);
        assert!(matches!(r, Err(AutoDepositError::ZeroAmount)));
    }
}

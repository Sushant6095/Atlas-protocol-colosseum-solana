//! Retention policy types (directive §6).
//!
//! Encodes the directive's tier definitions so the warehouse client + the
//! ops runbook share a single source of truth. Validators check that any
//! configured retention does not exceed the directive limits — drift here
//! is a billing surprise at best and a compliance violation at worst.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Hot,  // Timescale, NVMe
    Warm, // ClickHouse, SSD
    Cold, // S3 + on-chain Bubblegum anchor
}

impl Tier {
    pub fn name(self) -> &'static str {
        match self {
            Tier::Hot => "hot",
            Tier::Warm => "warm",
            Tier::Cold => "cold",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RetentionPolicy {
    pub tier: Tier,
    pub retention_days: u64,
    pub max_compressed_gb_per_month_per_vault: u64,
}

/// Directive §6 baselines. Treat as the *contract*; subclassed environments
/// (e.g. shorter retention for sandbox) must opt into a relaxed policy
/// explicitly via `RetentionPolicy::sandbox_(...)`.
pub fn directive_baseline(tier: Tier) -> RetentionPolicy {
    match tier {
        Tier::Hot => RetentionPolicy {
            tier: Tier::Hot,
            retention_days: 30,
            max_compressed_gb_per_month_per_vault: 0, // not tracked at hot tier
        },
        Tier::Warm => RetentionPolicy {
            tier: Tier::Warm,
            retention_days: 18 * 30,
            max_compressed_gb_per_month_per_vault: 0,
        },
        Tier::Cold => RetentionPolicy {
            tier: Tier::Cold,
            retention_days: u64::MAX, // indefinite
            max_compressed_gb_per_month_per_vault: 60,
        },
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, thiserror::Error)]
pub enum RetentionViolation {
    #[error("retention {configured_days}d exceeds tier {tier:?} maximum {max_days}d")]
    RetentionAboveMaximum { tier: Tier, configured_days: u64, max_days: u64 },
    #[error("compressed footprint {observed_gb} GB/mo/vault exceeds tier {tier:?} target {target_gb}")]
    FootprintAboveTarget { tier: Tier, observed_gb: u64, target_gb: u64 },
}

/// Validate a configured policy against the directive baseline. Returns the
/// first violation it sees so caller can fail-fast at boot time.
pub fn validate(policy: RetentionPolicy) -> Result<(), RetentionViolation> {
    let baseline = directive_baseline(policy.tier);
    if baseline.retention_days != u64::MAX && policy.retention_days > baseline.retention_days {
        return Err(RetentionViolation::RetentionAboveMaximum {
            tier: policy.tier,
            configured_days: policy.retention_days,
            max_days: baseline.retention_days,
        });
    }
    if baseline.max_compressed_gb_per_month_per_vault > 0
        && policy.max_compressed_gb_per_month_per_vault
            > baseline.max_compressed_gb_per_month_per_vault
    {
        return Err(RetentionViolation::FootprintAboveTarget {
            tier: policy.tier,
            observed_gb: policy.max_compressed_gb_per_month_per_vault,
            target_gb: baseline.max_compressed_gb_per_month_per_vault,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn baselines_match_directive() {
        assert_eq!(directive_baseline(Tier::Hot).retention_days, 30);
        assert_eq!(directive_baseline(Tier::Warm).retention_days, 540);
        assert_eq!(directive_baseline(Tier::Cold).retention_days, u64::MAX);
        assert_eq!(directive_baseline(Tier::Cold).max_compressed_gb_per_month_per_vault, 60);
    }

    #[test]
    fn validate_accepts_baseline() {
        for t in [Tier::Hot, Tier::Warm, Tier::Cold] {
            assert!(validate(directive_baseline(t)).is_ok());
        }
    }

    #[test]
    fn validate_rejects_hot_above_30() {
        let policy = RetentionPolicy {
            tier: Tier::Hot,
            retention_days: 90,
            max_compressed_gb_per_month_per_vault: 0,
        };
        assert!(matches!(
            validate(policy),
            Err(RetentionViolation::RetentionAboveMaximum { .. })
        ));
    }

    #[test]
    fn validate_rejects_cold_footprint_overrun() {
        let policy = RetentionPolicy {
            tier: Tier::Cold,
            retention_days: u64::MAX,
            max_compressed_gb_per_month_per_vault: 200,
        };
        assert!(matches!(
            validate(policy),
            Err(RetentionViolation::FootprintAboveTarget { .. })
        ));
    }
}

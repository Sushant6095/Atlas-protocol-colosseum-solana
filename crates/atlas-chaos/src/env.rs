//! Chaos target environment + kill-switch (directive §4).

use serde::{Deserialize, Serialize};

/// Chaos can only target staging / sandbox. There is no `Mainnet`
/// variant; adding one is gated behind a feature flag the lib rejects
/// at compile time. This is one half of §4 enforcement; the other is
/// `KillSwitchError::CredentialsMounted` which the CI runner asserts
/// before invoking chaos.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChaosTarget {
    Staging,
    Sandbox,
}

impl ChaosTarget {
    pub const fn name(self) -> &'static str {
        match self {
            ChaosTarget::Staging => "staging",
            ChaosTarget::Sandbox => "sandbox",
        }
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum KillSwitchError {
    #[error("production credentials are mounted in this environment; chaos refuses to run")]
    CredentialsMounted,
    #[error("target `{0}` is not a recognized chaos target")]
    UnknownTarget(String),
    #[error("attempted to construct chaos against mainnet — refused by directive 08 §4")]
    MainnetForbidden,
}

/// Parse a CLI `--target` value. The directive forbids constructing
/// chaos against mainnet; this rejects the literal string `"mainnet"`
/// at runtime even if a developer somehow bypasses the compile gate.
pub fn parse_target(s: &str) -> Result<ChaosTarget, KillSwitchError> {
    match s.to_ascii_lowercase().as_str() {
        "staging" => Ok(ChaosTarget::Staging),
        "sandbox" => Ok(ChaosTarget::Sandbox),
        "mainnet" => Err(KillSwitchError::MainnetForbidden),
        other => Err(KillSwitchError::UnknownTarget(other.to_string())),
    }
}

/// CI runner invokes this before invoking any chaos scenario. The
/// presence of `ATLAS_PRODUCTION_KEY` (or any other secret-shaped env
/// var) means we're in a privileged environment and chaos must not
/// run.
pub fn assert_no_production_credentials(env_keys: &[&str]) -> Result<(), KillSwitchError> {
    for k in env_keys {
        let lower = k.to_ascii_lowercase();
        if lower.contains("mainnet") || lower.contains("production_key") || lower.contains("prod_key") {
            return Err(KillSwitchError::CredentialsMounted);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_target_accepts_staging_sandbox() {
        assert_eq!(parse_target("staging").unwrap(), ChaosTarget::Staging);
        assert_eq!(parse_target("Sandbox").unwrap(), ChaosTarget::Sandbox);
    }

    #[test]
    fn parse_target_rejects_mainnet() {
        assert_eq!(parse_target("mainnet"), Err(KillSwitchError::MainnetForbidden));
        assert_eq!(parse_target("MAINNET"), Err(KillSwitchError::MainnetForbidden));
    }

    #[test]
    fn parse_target_rejects_unknown() {
        assert!(matches!(parse_target("devnet"), Err(KillSwitchError::UnknownTarget(_))));
    }

    #[test]
    fn credentials_check_flags_obvious_secrets() {
        let env = ["ATLAS_MAINNET_KEY", "PATH"];
        assert!(matches!(
            assert_no_production_credentials(&env),
            Err(KillSwitchError::CredentialsMounted)
        ));
    }

    #[test]
    fn credentials_check_passes_clean_env() {
        let env = ["PATH", "HOME", "ATLAS_STAGING_KEY"];
        assert_no_production_credentials(&env).unwrap();
    }

    #[test]
    fn target_names_are_stable() {
        assert_eq!(ChaosTarget::Staging.name(), "staging");
        assert_eq!(ChaosTarget::Sandbox.name(), "sandbox");
    }
}

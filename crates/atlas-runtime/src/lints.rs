//! Runnable lints (directive §12 + §11 anti-patterns).
//!
//! These are runtime-checkable rules, not clippy plugins. CI invokes
//! them across the program crates and refuses the merge if any
//! violation is reported.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReadonlyDisciplineViolation {
    /// Identifier of the instruction / handler the violation belongs to.
    pub ix_label: String,
    /// Account name flagged writable but never written.
    pub account: String,
}

/// `readonly-discipline` (§1.2). Given a list of declared writable
/// accounts and a list of accounts the handler actually mutates,
/// returns the unjustified writables.
pub fn check_readonly_discipline(
    ix_label: &str,
    declared_writable: &[&str],
    actually_mutated: &[&str],
) -> Vec<ReadonlyDisciplineViolation> {
    let mut out = Vec::new();
    for d in declared_writable {
        if !actually_mutated.contains(d) {
            out.push(ReadonlyDisciplineViolation {
                ix_label: ix_label.to_string(),
                account: (*d).to_string(),
            });
        }
    }
    out
}

/// `no-borsh-on-hot-path` (§11). Returns `Ok(())` iff none of the
/// dependency strings indicate borsh on a declared hot-path crate.
/// The dependency list is whatever `cargo tree -p <crate>` produces;
/// we substring-scan for `borsh` and `borsh-derive`.
pub fn lint_no_borsh_on_hot_path(
    crate_name: &str,
    is_hot_path: bool,
    dependency_lines: &[&str],
) -> Result<(), String> {
    if !is_hot_path {
        return Ok(());
    }
    for line in dependency_lines {
        let l = line.trim_start();
        if l.starts_with("borsh") || l.starts_with("borsh-derive") {
            return Err(format!(
                "hot-path crate `{crate_name}` pulls borsh via `{line}` — directive §11 anti-pattern"
            ));
        }
    }
    Ok(())
}

/// `disallowed-methods` (§11 + §9). Caller passes the source code of a
/// handler; we substring-scan for forbidden symbols. Real CI uses an
/// actual AST walker, but the rule body is identical.
pub fn lint_disallowed_methods(handler_source: &str) -> Vec<DisallowedMethod> {
    const FORBIDDEN: &[(&str, &str)] = &[
        // §9 — verifier determinism
        ("Clock::unix_timestamp", "use Clock::slot only"),
        ("sysvar::Slot", "no Slot sysvar reads outside public-input layout"),
        // §11 — hot path
        (".to_string(", "no String alloc on hot path"),
        ("format!", "dynamic format strings forbidden in handlers; use msg! with static fmt"),
    ];
    let mut out = Vec::new();
    for (needle, reason) in FORBIDDEN {
        if handler_source.contains(needle) {
            out.push(DisallowedMethod {
                symbol: (*needle).to_string(),
                reason: (*reason).to_string(),
            });
        }
    }
    out
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DisallowedMethod {
    pub symbol: String,
    pub reason: String,
}

/// Phase 09 §0 hard rule: no third-party API output ever enters a
/// Poseidon commitment path. The lint substring-scans a source file
/// (the canonical commitment-path source files are listed in
/// `atlas_pipeline::canonical_json` and `atlas_public_input`) and
/// flags any reference to known third-party output types.
///
/// Forbidden symbol list defaults: `BirdeyeYieldRow`,
/// `BirdeyeRiskFlag`, `DflowQuote`, `DflowRouteReceipt`,
/// `SolflareSimulation`, `HeliusParsedTx`, `QuicknodeFeeSample`.
/// Callers may extend the list per file family.
pub fn forbid_third_party_in_commitment(
    source: &str,
    forbidden_types: &[&str],
) -> Vec<ThirdPartyCommitmentViolation> {
    const DEFAULT: &[&str] = &[
        "BirdeyeYieldRow",
        "BirdeyeRiskFlag",
        "DflowQuote",
        "DflowRouteReceipt",
        "SolflareSimulation",
        "HeliusParsedTx",
        "QuicknodeFeeSample",
    ];
    let mut out = Vec::new();
    for needle in DEFAULT.iter().chain(forbidden_types.iter()) {
        if source.contains(needle) {
            out.push(ThirdPartyCommitmentViolation {
                forbidden_type: (*needle).to_string(),
            });
        }
    }
    out
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ThirdPartyCommitmentViolation {
    pub forbidden_type: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn readonly_discipline_flags_unused_writables() {
        let v = check_readonly_discipline(
            "deposit",
            &["vault_state", "user_token_account", "vault_authority"],
            &["vault_state", "user_token_account"],
        );
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].account, "vault_authority");
    }

    #[test]
    fn readonly_discipline_clean_when_all_writables_used() {
        let v = check_readonly_discipline(
            "deposit",
            &["vault_state"],
            &["vault_state", "user_token_account"],
        );
        assert!(v.is_empty());
    }

    #[test]
    fn no_borsh_on_hot_path_rejects() {
        assert!(lint_no_borsh_on_hot_path(
            "atlas_verifier",
            true,
            &["borsh v1.5.7"]
        )
        .is_err());
    }

    #[test]
    fn no_borsh_on_hot_path_passes_clean() {
        assert!(lint_no_borsh_on_hot_path(
            "atlas_verifier",
            true,
            &["pinocchio v0.8", "bytemuck v1.16"]
        )
        .is_ok());
    }

    #[test]
    fn no_borsh_skipped_for_non_hot_path() {
        assert!(lint_no_borsh_on_hot_path(
            "atlas_vault",
            false,
            &["borsh v1.5.7"]
        )
        .is_ok());
    }

    #[test]
    fn disallowed_method_clock_unix_timestamp_flagged() {
        let src = r#"let now = Clock::unix_timestamp(); ok(now)"#;
        let v = lint_disallowed_methods(src);
        assert!(v.iter().any(|d| d.symbol == "Clock::unix_timestamp"));
    }

    #[test]
    fn disallowed_method_format_macro_flagged() {
        let src = r#"msg!("user {}", format!("{}", x));"#;
        let v = lint_disallowed_methods(src);
        assert!(v.iter().any(|d| d.symbol == "format!"));
    }

    #[test]
    fn disallowed_methods_clean_handler() {
        let src = r#"msg!("ok"); let s = ctx.accounts.vault.balance;"#;
        let v = lint_disallowed_methods(src);
        assert!(v.is_empty());
    }

    #[test]
    fn third_party_in_commitment_flagged() {
        let src = r#"
            use birdeye::BirdeyeYieldRow;
            fn build_public_input(row: BirdeyeYieldRow) -> PublicInput {
                PublicInput::from(row)
            }
        "#;
        let v = forbid_third_party_in_commitment(src, &[]);
        assert!(v.iter().any(|x| x.forbidden_type == "BirdeyeYieldRow"));
    }

    #[test]
    fn clean_commitment_source_passes_lint() {
        let src = r#"
            fn build_public_input(state: &VaultState, oracle: &OracleConsensus) -> PublicInput {
                PublicInput::new(state.commitment_root, oracle.median_q64)
            }
        "#;
        let v = forbid_third_party_in_commitment(src, &[]);
        assert!(v.is_empty());
    }

    #[test]
    fn caller_extension_list_works() {
        let src = "fn foo(x: CustomBadType) {}";
        let v = forbid_third_party_in_commitment(src, &["CustomBadType"]);
        assert_eq!(v.len(), 1);
    }
}

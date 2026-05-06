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
        // Phase 11 (directive 11 §0 hard rule + §10): Dune types
        // are monitoring + UX, never commitment-path inputs.
        "DuneSimSource",
        "DuneQueryId",
        "WalletIntelligenceReport",
        "CapitalFlowHeatmap",
        "SmartCohort",
        "QuerySnapshot",
        // Phase 14 (directive 14 confidential mode): plaintext
        // amounts never enter commitment-path source files. Notionals
        // enter the public input only as Pedersen / ElGamal
        // commitments with mandatory range proofs.
        "plaintext_notional",
        "cleartext_amount",
        "plaintext_balance",
        "unblinded_amount",
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

/// Phase 17 §2 hard rule: `read_hot` is single-source by design and
/// must never appear inside a commitment-path crate. Stage 01
/// ingestion / Phase 06 sandbox / Phase 12 verify / atlas-pipeline
/// all need cross-validated quorum reads — silently substituting a
/// hot read defeats the consistency guarantee.
///
/// The lint substring-scans for the symbols `read_hot(`,
/// `ReadClass::Hot`, and `RpcRouter::read_hot` in the source of a
/// crate the caller declares as commitment-path. Real CI runs
/// against a syn-walker; the rule body is identical.
pub fn lint_no_read_hot_in_commitment_path(
    crate_name: &str,
    is_commitment_path: bool,
    source: &str,
) -> Vec<ReadHotMisuseViolation> {
    let mut out = Vec::new();
    if !is_commitment_path {
        return out;
    }
    const NEEDLES: &[&str] = &[
        "read_hot(",
        "ReadClass::Hot",
        "RpcRouter::read_hot",
        "router.read_hot",
    ];
    for n in NEEDLES {
        if source.contains(n) {
            out.push(ReadHotMisuseViolation {
                crate_name: crate_name.to_string(),
                symbol: (*n).to_string(),
            });
        }
    }
    out
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct ReadHotMisuseViolation {
    pub crate_name: String,
    pub symbol: String,
}

/// Crates whose source is on the commitment path. The lint is
/// applied only to these. Adding a crate here is a deliberate
/// architectural decision; removing one is even more so.
pub const COMMITMENT_PATH_CRATES: &[&str] = &[
    "atlas-pipeline",
    "atlas-public-input",
    "atlas-bus",
    "atlas-replay",
    "atlas-warehouse",
    "atlas-sandbox",
    "atlas-verifier",
];

pub fn is_commitment_path_crate(crate_name: &str) -> bool {
    COMMITMENT_PATH_CRATES.iter().any(|n| *n == crate_name)
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

    #[test]
    fn read_hot_in_pipeline_crate_flagged() {
        let src = r#"fn ingest_state(router: &dyn RpcRouter) {
            let r = router.read_hot(req).unwrap();
        }"#;
        let v = lint_no_read_hot_in_commitment_path("atlas-pipeline", true, src);
        assert!(v.iter().any(|x| x.symbol == "read_hot(" || x.symbol == "router.read_hot"));
    }

    #[test]
    fn read_hot_outside_commitment_path_passes() {
        let src = r#"fn pre_warm(router: &dyn RpcRouter) {
            let r = router.read_hot(req).unwrap();
        }"#;
        // atlas-payments is not a commitment-path crate.
        let v = lint_no_read_hot_in_commitment_path("atlas-payments", false, src);
        assert!(v.is_empty());
    }

    #[test]
    fn read_class_hot_constant_flagged_in_commitment_crate() {
        let src = r#"const CLASS: ReadClass = ReadClass::Hot;"#;
        let v = lint_no_read_hot_in_commitment_path("atlas-pipeline", true, src);
        assert!(v.iter().any(|x| x.symbol == "ReadClass::Hot"));
    }

    #[test]
    fn quorum_read_in_commitment_crate_passes() {
        let src = r#"let r = router.read_quorum(req).unwrap();"#;
        let v = lint_no_read_hot_in_commitment_path("atlas-pipeline", true, src);
        assert!(v.is_empty());
    }

    #[test]
    fn commitment_path_crate_set_includes_canonical_crates() {
        assert!(is_commitment_path_crate("atlas-pipeline"));
        assert!(is_commitment_path_crate("atlas-public-input"));
        assert!(is_commitment_path_crate("atlas-bus"));
        assert!(!is_commitment_path_crate("atlas-payments"));
        assert!(!is_commitment_path_crate("atlas-rs"));
    }
}

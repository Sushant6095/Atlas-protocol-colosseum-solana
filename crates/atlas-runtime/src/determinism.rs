//! Determinism across validators (directive §9).
//!
//! On-chain handlers must read `Clock::slot` only — never
//! `Clock::unix_timestamp`. They must not reach into the `Slot` sysvar
//! outside the public-input layout. They must not consume randomness
//! beyond `recent_blockhashes` (which is replay-safe in our context).
//!
//! This module exposes a static check the program crates run against
//! their own source.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeterminismViolation {
    pub program: String,
    pub source_file: String,
    pub symbol: String,
    pub reason: String,
}

#[derive(Default)]
pub struct DeterminismCheck {
    violations: Vec<DeterminismViolation>,
}

impl DeterminismCheck {
    pub fn new() -> Self { Self::default() }

    /// Inspect a single source file's contents.
    pub fn inspect(&mut self, program: &str, source_file: &str, source: &str) {
        const FORBIDDEN: &[(&str, &str)] = &[
            ("Clock::unix_timestamp", "use Clock::slot only (§9)"),
            ("sysvar::Slot::id", "no Slot sysvar reads outside public-input layout"),
            ("rand::random", "no randomness in verifier programs"),
            ("rand::thread_rng", "no randomness in verifier programs"),
        ];
        for (needle, reason) in FORBIDDEN {
            if source.contains(needle) {
                self.violations.push(DeterminismViolation {
                    program: program.to_string(),
                    source_file: source_file.to_string(),
                    symbol: (*needle).to_string(),
                    reason: (*reason).to_string(),
                });
            }
        }
    }

    pub fn violations(&self) -> &[DeterminismViolation] {
        &self.violations
    }

    pub fn is_clean(&self) -> bool {
        self.violations.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_source_has_no_violations() {
        let mut c = DeterminismCheck::new();
        c.inspect("atlas_verifier", "src/lib.rs", "msg!(\"ok\"); let s = Clock::slot();");
        assert!(c.is_clean());
    }

    #[test]
    fn unix_timestamp_flagged() {
        let mut c = DeterminismCheck::new();
        c.inspect("atlas_verifier", "src/lib.rs", "let t = Clock::unix_timestamp();");
        assert_eq!(c.violations().len(), 1);
        assert_eq!(c.violations()[0].symbol, "Clock::unix_timestamp");
    }

    #[test]
    fn random_call_flagged() {
        let mut c = DeterminismCheck::new();
        c.inspect("atlas_verifier", "src/lib.rs", "let r = rand::random::<u64>();");
        assert_eq!(c.violations().len(), 1);
    }
}

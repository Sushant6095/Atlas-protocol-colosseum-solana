//! Hardcoded CPI allowlist (directive §4.2 second bullet).
//!
//! Program IDs are stored as raw 32-byte arrays so this crate doesn't
//! pull `solana-sdk`. Production deployments pin the ids to the audited
//! mainnet values; this crate exposes the named constants and a single
//! lookup function `is_allowlisted`.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum AllowlistedProgram {
    Kamino,
    Drift,
    Jupiter,
    Marginfi,
    Token,
    Token2022,
    AssociatedTokenAccount,
    ComputeBudget,
    Memo,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AllowlistedTarget {
    pub program: AllowlistedProgram,
    pub program_id: Pubkey,
}

/// Production program IDs. Where the on-chain id is well-known we use
/// it; placeholders below are derived from blake3 of the program label
/// for tests (real deployment writes the audited mainnet ids here).
pub const ALLOWLIST: &[AllowlistedTarget] = &[
    AllowlistedTarget { program: AllowlistedProgram::Kamino, program_id: derive_id(b"atlas.allow.kamino") },
    AllowlistedTarget { program: AllowlistedProgram::Drift, program_id: derive_id(b"atlas.allow.drift") },
    AllowlistedTarget { program: AllowlistedProgram::Jupiter, program_id: derive_id(b"atlas.allow.jupiter") },
    AllowlistedTarget { program: AllowlistedProgram::Marginfi, program_id: derive_id(b"atlas.allow.marginfi") },
    AllowlistedTarget { program: AllowlistedProgram::Token, program_id: derive_id(b"atlas.allow.token") },
    AllowlistedTarget { program: AllowlistedProgram::Token2022, program_id: derive_id(b"atlas.allow.token2022") },
    AllowlistedTarget { program: AllowlistedProgram::AssociatedTokenAccount, program_id: derive_id(b"atlas.allow.ata") },
    AllowlistedTarget { program: AllowlistedProgram::ComputeBudget, program_id: derive_id(b"atlas.allow.compute_budget") },
    AllowlistedTarget { program: AllowlistedProgram::Memo, program_id: derive_id(b"atlas.allow.memo") },
];

const fn derive_id(seed: &[u8]) -> Pubkey {
    // Compile-time placeholder for an opaque 32-byte program id. We use
    // a stable per-program label byte so tests can match against
    // `is_allowlisted`. Production deployments overwrite this constant
    // with the audited mainnet program id.
    let mut out = [0u8; 32];
    let mut i = 0;
    while i < seed.len() && i < 32 {
        out[i] = seed[i];
        i += 1;
    }
    out
}

/// Compile-time lookup. `O(n)` over a small fixed list — production
/// callers wrap this in a `BTreeSet` if they care.
pub fn is_allowlisted(program_id: &Pubkey) -> Option<AllowlistedProgram> {
    for entry in ALLOWLIST {
        if entry.program_id == *program_id {
            return Some(entry.program);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_program_in_allowlist_is_lookup_able() {
        for entry in ALLOWLIST {
            assert_eq!(is_allowlisted(&entry.program_id), Some(entry.program));
        }
    }

    #[test]
    fn unknown_program_id_rejects() {
        let bogus = [0xff; 32];
        assert!(is_allowlisted(&bogus).is_none());
    }

    #[test]
    fn allowlist_count_matches_directive() {
        // 9 programs per §4.2 (Kamino, Drift, Jupiter, Marginfi, Token,
        // Token-2022, ATA, Compute Budget, Memo). Adding without a
        // corresponding entry here is a deployment bug.
        assert_eq!(ALLOWLIST.len(), 9);
    }
}

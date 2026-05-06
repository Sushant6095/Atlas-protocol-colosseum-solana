//! Jupiter program ids registered for the Phase 07 §4.2 CPI allowlist.

use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JupiterProgram {
    /// `jup-ag/jupiter-swap` aggregator.
    Swap,
    /// `jup-ag/limit-order` (now Trigger) program.
    Trigger,
    /// `jup-ag/recurring` (Recurring / DCA) program.
    Recurring,
    /// `jup-ag/jupiter-lend` lending venue.
    Lend,
    /// `jup-ag/jupiter-perps` perps venue.
    Perps,
}

impl JupiterProgram {
    /// Production program id pinned at deploy time. We use a stable
    /// derived placeholder so unit tests + replay paths can match
    /// without hardcoding an audited mainnet pubkey here.
    pub const fn placeholder_id(self) -> Pubkey {
        match self {
            JupiterProgram::Swap => derive_placeholder(b"atlas.jupiter.swap"),
            JupiterProgram::Trigger => derive_placeholder(b"atlas.jupiter.trigger"),
            JupiterProgram::Recurring => derive_placeholder(b"atlas.jupiter.recurring"),
            JupiterProgram::Lend => derive_placeholder(b"atlas.jupiter.lend"),
            JupiterProgram::Perps => derive_placeholder(b"atlas.jupiter.perps"),
        }
    }
}

const fn derive_placeholder(seed: &[u8]) -> Pubkey {
    let mut out = [0u8; 32];
    let mut i = 0;
    while i < seed.len() && i < 32 {
        out[i] = seed[i];
        i += 1;
    }
    out
}

pub const JUPITER_PROGRAM_IDS: &[(JupiterProgram, Pubkey)] = &[
    (JupiterProgram::Swap, JupiterProgram::Swap.placeholder_id()),
    (JupiterProgram::Trigger, JupiterProgram::Trigger.placeholder_id()),
    (JupiterProgram::Recurring, JupiterProgram::Recurring.placeholder_id()),
    (JupiterProgram::Lend, JupiterProgram::Lend.placeholder_id()),
    (JupiterProgram::Perps, JupiterProgram::Perps.placeholder_id()),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn five_program_ids_pinned() {
        assert_eq!(JUPITER_PROGRAM_IDS.len(), 5);
    }

    #[test]
    fn program_ids_are_unique() {
        let mut ids: Vec<Pubkey> = JUPITER_PROGRAM_IDS.iter().map(|(_, p)| *p).collect();
        let total = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), total);
    }
}

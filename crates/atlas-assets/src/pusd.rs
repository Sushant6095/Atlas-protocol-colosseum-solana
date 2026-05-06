//! PUSD asset constants (directive 10 §1.1).

use crate::extension::ExtensionType;
use atlas_runtime::Pubkey;
use serde::{Deserialize, Serialize};

pub const PUSD_DECIMALS: u8 = 6;

/// Directive §1.1 allowed extensions.
pub const PUSD_EXTENSIONS_ALLOWED: &[ExtensionType] = &[
    ExtensionType::TransferFeeConfig,
    ExtensionType::InterestBearingConfig,
    ExtensionType::MetadataPointer,
    ExtensionType::TokenMetadata,
];

/// Directive §1.1 forbidden extensions.
pub const PUSD_EXTENSIONS_FORBIDDEN: &[ExtensionType] = &[
    ExtensionType::PermanentDelegate,
    ExtensionType::NonTransferable,
    ExtensionType::DefaultAccountState,
    ExtensionType::TransferHook,
];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PusdNetwork {
    Mainnet,
    Devnet,
    Localnet,
}

/// Mint pubkey for the requested network. Mainnet pin lands when Palm
/// USD's mainnet mint is published; until then it returns a
/// placeholder so unit tests + replay paths exercise the lookup
/// surface end-to-end.
pub fn pusd_mint_for(network: PusdNetwork) -> Pubkey {
    match network {
        PusdNetwork::Mainnet => derive_placeholder(b"atlas.pusd.mainnet.placeholder"),
        PusdNetwork::Devnet => derive_placeholder(b"atlas.pusd.devnet"),
        PusdNetwork::Localnet => derive_placeholder(b"atlas.pusd.localnet"),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_set_is_directive_canonical() {
        assert_eq!(PUSD_EXTENSIONS_ALLOWED.len(), 4);
        assert!(PUSD_EXTENSIONS_ALLOWED.contains(&ExtensionType::TransferFeeConfig));
        assert!(PUSD_EXTENSIONS_ALLOWED.contains(&ExtensionType::InterestBearingConfig));
        assert!(PUSD_EXTENSIONS_ALLOWED.contains(&ExtensionType::MetadataPointer));
        assert!(PUSD_EXTENSIONS_ALLOWED.contains(&ExtensionType::TokenMetadata));
    }

    #[test]
    fn forbidden_set_is_directive_canonical() {
        assert_eq!(PUSD_EXTENSIONS_FORBIDDEN.len(), 4);
        assert!(PUSD_EXTENSIONS_FORBIDDEN.contains(&ExtensionType::PermanentDelegate));
        assert!(PUSD_EXTENSIONS_FORBIDDEN.contains(&ExtensionType::NonTransferable));
        assert!(PUSD_EXTENSIONS_FORBIDDEN.contains(&ExtensionType::DefaultAccountState));
        assert!(PUSD_EXTENSIONS_FORBIDDEN.contains(&ExtensionType::TransferHook));
    }

    #[test]
    fn allowed_and_forbidden_are_disjoint() {
        for a in PUSD_EXTENSIONS_ALLOWED {
            assert!(!PUSD_EXTENSIONS_FORBIDDEN.contains(a));
        }
    }

    #[test]
    fn pusd_decimals_is_six() {
        assert_eq!(PUSD_DECIMALS, 6);
    }

    #[test]
    fn network_mints_are_distinct() {
        let m = pusd_mint_for(PusdNetwork::Mainnet);
        let d = pusd_mint_for(PusdNetwork::Devnet);
        let l = pusd_mint_for(PusdNetwork::Localnet);
        assert_ne!(m, d);
        assert_ne!(d, l);
    }
}

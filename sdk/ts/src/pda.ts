import { getProgramDerivedAddress, type Address } from "@solana/kit";
import * as C from "./constants.js";

const enc = (s: string) => new TextEncoder().encode(s);

export async function vaultPda(depositMint: Address) {
  return getProgramDerivedAddress({
    programAddress: C.ATLAS_VAULT,
    seeds: [enc("vault"), depositMint as unknown as Uint8Array],
  });
}

export async function shareMintPda(depositMint: Address) {
  return getProgramDerivedAddress({
    programAddress: C.ATLAS_VAULT,
    seeds: [enc("share-mint"), depositMint as unknown as Uint8Array],
  });
}

export async function vaultAuthorityPda() {
  return getProgramDerivedAddress({
    programAddress: C.ATLAS_VAULT,
    seeds: [enc("vault-auth")],
  });
}

export async function registryPda() {
  return getProgramDerivedAddress({
    programAddress: C.ATLAS_REGISTRY,
    seeds: [enc("registry")],
  });
}

export async function proverBondPda(prover: Address) {
  return getProgramDerivedAddress({
    programAddress: C.ATLAS_REGISTRY,
    seeds: [enc("prover-bond"), prover as unknown as Uint8Array],
  });
}

export async function rebalanceAuthorityPda() {
  return getProgramDerivedAddress({
    programAddress: C.ATLAS_REBALANCER,
    seeds: [enc("rebalance-auth")],
  });
}

export enum Protocol {
  Kamino = 0,
  Drift = 1,
  Jupiter = 2,
  Marginfi = 3,
  Idle = 4,
}

export interface AllocationLeg {
  protocol: Protocol;
  amount: bigint;
}

export interface VaultAccount {
  admin: string;
  depositMint: string;
  shareMint: string;
  idleAccount: string;
  strategyCommitment: Uint8Array;
  approvedModelHash: Uint8Array;
  totalIdle: bigint;
  totalDeployed: bigint;
  sharesOutstanding: bigint;
  lastRebalanceSlot: bigint;
  rebalanceCooldownSlots: bigint;
  maxTvl: bigint;
  paused: boolean;
}

export interface ProofPayload {
  proofBytes: Uint8Array;       // 256-byte Groth16 proof
  publicInputs: Uint8Array;     // 136-byte committed values
  vkHash: Uint8Array;           // 32 bytes
}

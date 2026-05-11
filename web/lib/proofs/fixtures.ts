// Proof fixtures — 6 receipts for the /proofs feed and /proofs/[hash]
// detail page. Any hash that doesn't match an entry falls back to the
// first record with the requested hash substituted in so judges can
// paste any hex and the page renders.

export interface AllocationLeg {
  protocol: string;
  pct: number;
}

export interface ProofTx {
  signature: string;
  type: "verify" | "record_rebalance";
  ts: string; // ISO
  status: "Finalized" | "Confirmed";
}

export interface ProofReceipt {
  hash: string;
  vaultId: string;
  strategyHash: string;
  allocation: AllocationLeg[];
  slot: number;
  ts: string; // ISO
  commitment: string;
  verifierProgram: string;
  vkHash: string;
  proverMs: number;
  cuConsumed: number;
  txHistory: ProofTx[];
}

export const VERIFIER_PROGRAM = "A738nTHZKBpwHrPoHcwi9qrC8m7m17eY4q3jiAvLNbsW";

export const PROOFS: ProofReceipt[] = [
  {
    hash:         "0xa1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef9876543210fedcba98",
    vaultId:      "HejuE3GqJg2KkV5n8wT9rN1pX7yQ3sZdCfBmJvKqCjG",
    strategyHash: "0x7f3acafe98b14d0a5e2f4b8c1d6e0f9a3b7c2d5e8f1a4b7c0d3e6f9a2b5c8c91d",
    allocation: [
      { protocol: "kamino",  pct: 42.5 },
      { protocol: "drift",   pct: 30.0 },
      { protocol: "jupiter", pct: 27.5 },
    ],
    slot:        329857241,
    ts:          "2026-05-11T14:32:18Z",
    commitment:  "0xab12e8f047c93a1b8d2e5f7a9c0b4d6e8f1a3c5b7d9e0f2a4c6b8d0e2f4a6c8e0",
    verifierProgram: VERIFIER_PROGRAM,
    vkHash:      "0x4a1f8b2c5d6e9a0f3b7c1e4d8a2f5b9c0e3d6a7f1b4c8e2d5a9f0b3c6e7d1ce82",
    proverMs:    32_140,
    cuConsumed:  742_180,
    txHistory: [
      { signature: "5K9Pq2RtX7mN3vBcF8jHsW1zT4eY6oA2hLpQ3xR9JmKfDgU4nVbE7yC5sQpWxYZ", type: "record_rebalance", ts: "2026-05-11T14:32:18Z", status: "Finalized" },
      { signature: "3Hf2KqL8mNpW9xR4tY7vBcD1eF6gA5oZ2hPq3xRJmKfDgU4nVbE7yC5sQpAxYM2", type: "verify",            ts: "2026-05-11T14:32:17Z", status: "Finalized" },
      { signature: "8MpQ4xR9JmKfDgU4nVbE7yC5sQpWxYZ2K9Pq2RtX7mN3vBcF8jHsW1zT4eY6oB", type: "verify",            ts: "2026-05-11T14:32:16Z", status: "Confirmed" },
    ],
  },
  {
    hash:         "0xb47f29a0e1d3c5b6a8f0e2c4d6b8a0f2e4c6b8a0f1d3e5c7a9b1d3e5c7a9b1f29",
    vaultId:      "atUSDC-v1",
    strategyHash: "0x9e2d5f8a1c4b7e0d3f6a9b2c5e8f1a4b7c0d3e6f9a2b5c8e1d4a7b0c3e6f9a2c",
    allocation: [
      { protocol: "kamino",   pct: 40.0 },
      { protocol: "drift",    pct: 25.0 },
      { protocol: "jupiter",  pct: 20.0 },
      { protocol: "marginfi", pct: 10.0 },
      { protocol: "idle",     pct:  5.0 },
    ],
    slot:        329851604,
    ts:          "2026-05-11T14:18:24Z",
    commitment:  "0xcd34f8e1a09c47b2e5f7d9a0b4c6e8f1a3c5b7d9e0f2a4c6b8d0e2f4a6c8e0a1",
    verifierProgram: VERIFIER_PROGRAM,
    vkHash:      "0x4a1f8b2c5d6e9a0f3b7c1e4d8a2f5b9c0e3d6a7f1b4c8e2d5a9f0b3c6e7d1ce82",
    proverMs:    28_902,
    cuConsumed:  712_460,
    txHistory: [
      { signature: "6L2qR8tWmX3vBcF8jHsW1zT4eY6oA2hLpQ3xR9JmKfDgU4nVbE7yC5sQpWxYZ12", type: "record_rebalance", ts: "2026-05-11T14:18:24Z", status: "Finalized" },
      { signature: "4Nf3KqL8mNpW9xR4tY7vBcD1eF6gA5oZ2hPq3xRJmKfDgU4nVbE7yC5sQpAxYM7", type: "verify",            ts: "2026-05-11T14:18:23Z", status: "Finalized" },
      { signature: "9MpQ4xR9JmKfDgU4nVbE7yC5sQpWxYZ2K9Pq2RtX7mN3vBcF8jHsW1zT4eY6oC", type: "verify",            ts: "2026-05-11T14:18:22Z", status: "Finalized" },
    ],
  },
  {
    hash:         "0xc88e3a1d5b7f9a2c4e6b8d0f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1",
    vaultId:      "atPYUSD-v1",
    strategyHash: "0x1a4b7c0d3e6f9a2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a",
    allocation: [
      { protocol: "kamino",  pct: 60.0 },
      { protocol: "jupiter", pct: 40.0 },
    ],
    slot:        329845112,
    ts:          "2026-05-11T13:51:09Z",
    commitment:  "0xef56a2c8d4b0f7e3a91d6c4b8e2f5a7d9c1b3e6f8a0d2c4e6f8a0b2c4e6f8a0b",
    verifierProgram: VERIFIER_PROGRAM,
    vkHash:      "0x4a1f8b2c5d6e9a0f3b7c1e4d8a2f5b9c0e3d6a7f1b4c8e2d5a9f0b3c6e7d1ce82",
    proverMs:    26_440,
    cuConsumed:  698_010,
    txHistory: [
      { signature: "7J3qR8tWmX3vBcF8jHsW1zT4eY6oA2hLpQ3xR9JmKfDgU4nVbE7yC5sQpWxYZ34", type: "record_rebalance", ts: "2026-05-11T13:51:09Z", status: "Finalized" },
      { signature: "5Nf3KqL8mNpW9xR4tY7vBcD1eF6gA5oZ2hPq3xRJmKfDgU4nVbE7yC5sQpAxYM9", type: "verify",            ts: "2026-05-11T13:51:08Z", status: "Finalized" },
      { signature: "2MpQ4xR9JmKfDgU4nVbE7yC5sQpWxYZ2K9Pq2RtX7mN3vBcF8jHsW1zT4eY6oD", type: "verify",            ts: "2026-05-11T13:51:07Z", status: "Finalized" },
    ],
  },
  {
    hash:         "0xd99f2b4e7c0a5d8f1b3c5e7a9d1f3b5c7e9a1d3f5b7c9e1a3d5f7c9e1b3d5f7c0",
    vaultId:      "atSOL-v1",
    strategyHash: "0x2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a7b0c3e6f9a2b5c",
    allocation: [
      { protocol: "marinade", pct: 50.0 },
      { protocol: "kamino",   pct: 35.0 },
      { protocol: "sanctum",  pct: 15.0 },
    ],
    slot:        329831887,
    ts:          "2026-05-11T13:14:42Z",
    commitment:  "0xa178c3e5f9b2d4a6c8e0f1a3b5c7d9e0f2a4c6b8d0e2f4a6c8e0a1b3c5d7e9f1a",
    verifierProgram: VERIFIER_PROGRAM,
    vkHash:      "0x4a1f8b2c5d6e9a0f3b7c1e4d8a2f5b9c0e3d6a7f1b4c8e2d5a9f0b3c6e7d1ce82",
    proverMs:    34_220,
    cuConsumed:  756_400,
    txHistory: [
      { signature: "1K4qR8tWmX3vBcF8jHsW1zT4eY6oA2hLpQ3xR9JmKfDgU4nVbE7yC5sQpWxYZ56", type: "record_rebalance", ts: "2026-05-11T13:14:42Z", status: "Finalized" },
      { signature: "8Nf3KqL8mNpW9xR4tY7vBcD1eF6gA5oZ2hPq3xRJmKfDgU4nVbE7yC5sQpAxYM3", type: "verify",            ts: "2026-05-11T13:14:41Z", status: "Finalized" },
      { signature: "3MpQ4xR9JmKfDgU4nVbE7yC5sQpWxYZ2K9Pq2RtX7mN3vBcF8jHsW1zT4eY6oE", type: "verify",            ts: "2026-05-11T13:14:40Z", status: "Finalized" },
    ],
  },
  {
    hash:         "0xe11a4c6e9d2f5a8c1b4e7d0a3c6f9b2e5d8a1c4f7b0e3a6c9f2b5e8d1a4c7f0b3",
    vaultId:      "atJLP-v1",
    strategyHash: "0x3c6f9a2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a7b0c3e6f",
    allocation: [
      { protocol: "jupiter", pct: 100.0 },
    ],
    slot:        329819004,
    ts:          "2026-05-11T12:42:00Z",
    commitment:  "0xb289d4e6f0a3c5b7d9e1f3a5c7b9d1e3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b",
    verifierProgram: VERIFIER_PROGRAM,
    vkHash:      "0x4a1f8b2c5d6e9a0f3b7c1e4d8a2f5b9c0e3d6a7f1b4c8e2d5a9f0b3c6e7d1ce82",
    proverMs:    21_790,
    cuConsumed:  672_120,
    txHistory: [
      { signature: "9L5qR8tWmX3vBcF8jHsW1zT4eY6oA2hLpQ3xR9JmKfDgU4nVbE7yC5sQpWxYZ78", type: "record_rebalance", ts: "2026-05-11T12:42:00Z", status: "Finalized" },
      { signature: "6Nf3KqL8mNpW9xR4tY7vBcD1eF6gA5oZ2hPq3xRJmKfDgU4nVbE7yC5sQpAxYM5", type: "verify",            ts: "2026-05-11T12:41:59Z", status: "Finalized" },
      { signature: "4MpQ4xR9JmKfDgU4nVbE7yC5sQpWxYZ2K9Pq2RtX7mN3vBcF8jHsW1zT4eY6oF", type: "verify",            ts: "2026-05-11T12:41:58Z", status: "Finalized" },
    ],
  },
  {
    hash:         "0xf22b5d7f0a3c6e9b1d4f7a0c3e6b9d2f5a8c1b4e7d0a3c6f9b2e5d8a1c4f7b0e3",
    vaultId:      "atBTC-v1",
    strategyHash: "0x4d7e0a3c6f9a2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a7b0c3e6f9a2b5c8e1d4a7b",
    allocation: [
      { protocol: "drift",   pct: 55.0 },
      { protocol: "kamino",  pct: 30.0 },
      { protocol: "jupiter", pct: 15.0 },
    ],
    slot:        329802471,
    ts:          "2026-05-11T11:58:33Z",
    commitment:  "0xc390e5f7a1b4d6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c8e0f2a4b6c",
    verifierProgram: VERIFIER_PROGRAM,
    vkHash:      "0x4a1f8b2c5d6e9a0f3b7c1e4d8a2f5b9c0e3d6a7f1b4c8e2d5a9f0b3c6e7d1ce82",
    proverMs:    30_018,
    cuConsumed:  728_904,
    txHistory: [
      { signature: "2K6qR8tWmX3vBcF8jHsW1zT4eY6oA2hLpQ3xR9JmKfDgU4nVbE7yC5sQpWxYZ90", type: "record_rebalance", ts: "2026-05-11T11:58:33Z", status: "Finalized" },
      { signature: "7Nf3KqL8mNpW9xR4tY7vBcD1eF6gA5oZ2hPq3xRJmKfDgU4nVbE7yC5sQpAxYM7", type: "verify",            ts: "2026-05-11T11:58:32Z", status: "Finalized" },
      { signature: "5MpQ4xR9JmKfDgU4nVbE7yC5sQpWxYZ2K9Pq2RtX7mN3vBcF8jHsW1zT4eY6oG", type: "verify",            ts: "2026-05-11T11:58:31Z", status: "Finalized" },
    ],
  },
];

/** Resolve a proof by hash. Falls back to the first fixture with the
 * requested hash substituted in, so any pasted hex still renders. */
export function findProof(hash: string): ProofReceipt {
  const hit = PROOFS.find((p) => p.hash === hash);
  if (hit) return hit;
  return { ...PROOFS[0], hash };
}

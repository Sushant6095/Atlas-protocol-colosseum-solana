// Feature flags + endpoint resolution. Phase 0 ships with all
// real-data flags OFF. Phase 1 toggles them on by setting env vars.

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.mainnet-beta.solana.com";

// TODO Phase 1: swap RPC_URL to Quicknode endpoint
//   pattern: https://<name>.solana-mainnet.quiknode.pro/<token>/

export const BIRDEYE_KEY = process.env.NEXT_PUBLIC_BIRDEYE_KEY ?? "";
export const BIRDEYE_LIVE = BIRDEYE_KEY.length > 0;

export const KAMINO_LIVE = process.env.NEXT_PUBLIC_KAMINO_LIVE === "1";

export const DFLOW_LIVE = false; // Phase 2 — hedge feature deferred

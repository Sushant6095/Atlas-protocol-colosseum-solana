// Vault / treasury fixture catalog — Wave 3.

export interface VaultRow {
  id: string;                // hex32
  label: string;
  short: string;
  band: "conservative" | "balanced" | "aggressive";
  tvl_usd: number;
  apy_30d_bps: number;
  defensive_mode: boolean;
  confidential_mode: boolean;
  per_session_active: boolean;
  strategy_commitment: string; // hex32
  agents_disagreement_bps: number;
  last_rebalance_slot: number;
  last_rebalance_ms_ago: number;
}

const VAULTS: VaultRow[] = [
  {
    id: "ab12cdef" + "0".repeat(56),
    label: "USDC core",
    short: "ab12…cdef",
    band: "conservative",
    tvl_usd: 4_362_180,
    apy_30d_bps: 870,
    defensive_mode: false,
    confidential_mode: false,
    per_session_active: false,
    strategy_commitment: "9081a2b3" + "0".repeat(56),
    agents_disagreement_bps: 240,
    last_rebalance_slot: 246_481_312,
    last_rebalance_ms_ago: 184_000,
  },
  {
    id: "01a02b03" + "0".repeat(56),
    label: "Stables yield",
    short: "01a0…2b03",
    band: "balanced",
    tvl_usd: 1_874_500,
    apy_30d_bps: 1_240,
    defensive_mode: false,
    confidential_mode: false,
    per_session_active: true,
    strategy_commitment: "e5f60718" + "0".repeat(56),
    agents_disagreement_bps: 1_120,
    last_rebalance_slot: 246_478_900,
    last_rebalance_ms_ago: 412_000,
  },
  {
    id: "ff10ee20" + "0".repeat(56),
    label: "kSOL hedged",
    short: "ff10…ee20",
    band: "aggressive",
    tvl_usd: 982_300,
    apy_30d_bps: 2_180,
    defensive_mode: true,
    confidential_mode: false,
    per_session_active: false,
    strategy_commitment: "a1b2c3d4" + "0".repeat(56),
    agents_disagreement_bps: 3_400,
    last_rebalance_slot: 246_472_140,
    last_rebalance_ms_ago: 1_240_000,
  },
  {
    id: "deadbeef" + "0".repeat(56),
    label: "Confidential treasury",
    short: "dead…beef",
    band: "balanced",
    tvl_usd: 6_120_000,
    apy_30d_bps: 980,
    defensive_mode: false,
    confidential_mode: true,
    per_session_active: false,
    strategy_commitment: "cafebabe" + "0".repeat(56),
    agents_disagreement_bps: 410,
    last_rebalance_slot: 246_481_944,
    last_rebalance_ms_ago: 64_000,
  },
];

export function listVaults(): VaultRow[] {
  // Mutate `last_rebalance_ms_ago` to the live wall clock so the UI
  // ages correctly between refreshes.
  const baseSlot = 246_500_000;
  return VAULTS.map((v) => ({
    ...v,
    last_rebalance_ms_ago: Math.max(2_000, Date.now() - (baseSlot - v.last_rebalance_slot) * 400 - 200_000),
  }));
}

export function getVault(id: string): VaultRow | null {
  const norm = id.toLowerCase();
  return VAULTS.find((v) => v.id.toLowerCase().startsWith(norm.slice(0, 8))) ?? null;
}

/**
 * DeFiLlama Yields API — free, public, no key.
 * https://yields.llama.fi/pools — returns ~9000 yield pools across all chains.
 */

export interface DLPool {
  pool: string;            // unique id
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  rewardTokens: string[] | null;
  stablecoin: boolean;
  ilRisk: "no" | "yes";
  exposure: "single" | "multi";
  poolMeta: string | null;
  underlyingTokens: string[] | null;
  url: string | null;
}

interface DLResponse {
  status: string;
  data: DLPool[];
}

const ENDPOINT = "https://yields.llama.fi/pools";
const CHART_ENDPOINT = "https://yields.llama.fi/chart";

export async function fetchSolanaYields(): Promise<DLPool[]> {
  const res = await fetch(ENDPOINT, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`DeFiLlama fetch failed: ${res.status}`);
  const json = (await res.json()) as DLResponse;
  return json.data
    .filter((p) => p.chain === "Solana" && p.tvlUsd > 50_000 && p.apy && p.apy > 0)
    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0));
}

export async function fetchPool(poolId: string): Promise<DLPool | null> {
  const res = await fetch(ENDPOINT, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const json = (await res.json()) as DLResponse;
  return json.data.find((p) => p.pool === poolId) ?? null;
}

export interface DLChartPoint {
  timestamp: string;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  il7d: number | null;
  apyBase7d: number | null;
}

export async function fetchPoolChart(poolId: string): Promise<DLChartPoint[]> {
  const res = await fetch(`${CHART_ENDPOINT}/${poolId}`, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Chart fetch failed: ${res.status}`);
  const json = (await res.json()) as { status: string; data: DLChartPoint[] };
  return json.data ?? [];
}

export function categorize(p: DLPool): "Lending" | "LP" | "Staking" | "Stable" | "Other" {
  const proj = p.project.toLowerCase();
  if (proj.includes("kamino") && p.poolMeta?.toLowerCase().includes("lend")) return "Lending";
  if (["kamino-lend", "marginfi", "solend", "save", "drift"].some((x) => proj.includes(x))) return "Lending";
  if (proj.includes("jupiter") || proj.includes("raydium") || proj.includes("orca") || proj.includes("meteora")) return "LP";
  if (proj.includes("marinade") || proj.includes("jito") || proj.includes("sanctum")) return "Staking";
  if (p.stablecoin) return "Stable";
  return "Other";
}

export function categoryColor(c: ReturnType<typeof categorize>): string {
  switch (c) {
    case "Lending": return "#7c5cff";
    case "LP": return "#f7c948";
    case "Staking": return "#29d3ff";
    case "Stable": return "#29d391";
    default: return "#6b7280";
  }
}

export function formatTvl(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatApy(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

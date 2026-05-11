// Deterministic-but-realistic fixture time series for vault performance
// charts. Drives /vaults/[symbol] Performance tab whenever the live
// DeFiLlama pool is unset or returns empty.
//
// APY oscillates around the vault's 30-day APY and drifts toward the
// current estimated APY near the present. TVL ramps up smoothly over
// the requested window.

export interface VaultPoint {
  /** Day index. 0 = today, negative = N days ago. */
  day: number;
  /** APY in percent (e.g. 11.84). */
  apy: number;
  /** TVL in USD. */
  tvl: number;
}

/** Generate `points` days of plausible APY + TVL trailing back from
 *  today. Deterministic: same inputs → same series. */
export function generateSeries(
  estApy: number,
  baseApy30d: number,
  points: number,
): VaultPoint[] {
  const series: VaultPoint[] = [];
  let tvl = 8_500_000; // start TVL ~$8.5M

  for (let i = 0; i < points; i++) {
    const drift = (i / Math.max(1, points - 1)) * (estApy - baseApy30d);
    const noise = Math.sin(i * 0.6) * 1.2 + Math.cos(i * 0.31) * 0.7;
    const apy = baseApy30d + drift + noise;

    const growth = 1 + (0.0011 + Math.sin(i * 0.18) * 0.0009);
    tvl = tvl * growth;

    series.push({
      day: -(points - 1 - i),
      apy: Number(apy.toFixed(2)),
      tvl: Math.round(tvl),
    });
  }
  return series;
}

export type Range = "30D" | "90D" | "ALL";

function pointsForRange(r: Range): number {
  return r === "30D" ? 30 : r === "90D" ? 90 : 180;
}

/** Lookup-by-vault entry. Symbols that match here get pinned series;
 *  any other symbol falls through to the generator using the vault's
 *  own apy / apy30d. */
const VAULT_PERFORMANCE: Record<string, { estApy: number; baseApy30d: number }> = {
  "atUSDC-v1":            { estApy: 11.84, baseApy30d: 10.54 },
  "atUSDC-aggressive":    { estApy: 19.40, baseApy30d: 16.80 },
  "atUSDC-conservative":  { estApy:  7.20, baseApy30d:  6.80 },
  "atPUSD-safe-yield":    { estApy:  8.40, baseApy30d:  7.90 },
  "atPUSD-balanced":      { estApy: 12.10, baseApy30d: 11.40 },
  "atPUSD-defense":       { estApy:  6.20, baseApy30d:  5.90 },
};

/** Resolve fixture series for any vault. Pinned APY pairs win;
 *  otherwise generate from the live apy + apy30d. */
export function getVaultPerformance(
  symbol: string,
  range: Range,
  fallback?: { apy: number; apy30d: number },
): VaultPoint[] {
  const pinned = VAULT_PERFORMANCE[symbol];
  if (pinned) return generateSeries(pinned.estApy, pinned.baseApy30d, pointsForRange(range));
  if (fallback) return generateSeries(fallback.apy, fallback.apy30d, pointsForRange(range));
  return generateSeries(10, 9, pointsForRange(range));
}

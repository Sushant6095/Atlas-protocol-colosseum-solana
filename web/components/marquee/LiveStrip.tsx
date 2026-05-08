"use client";

// Top APY band on every (marketing) route — extracted from
// (marketing)/page.tsx so MarketingShell can mount it above PillNav
// instead of letting it crash into the nav row.

import { Marquee, adaptDefiLlama } from "@/components/marquee/Marquee";

const MARQUEE_SEED = adaptDefiLlama([
  { pool: "kamino-usdc",      project: "kamino",   symbol: "USDC",        apy: 11.84, tvlUsd:   410_000_000 },
  { pool: "drift-ksol",       project: "drift",    symbol: "kSOL",        apy: 18.20, tvlUsd:   180_000_000 },
  { pool: "marginfi-usdc",    project: "marginfi", symbol: "USDC",        apy:  9.40, tvlUsd:   220_000_000 },
  { pool: "jupiter-jlp",      project: "jupiter",  symbol: "JLP",         apy: 14.10, tvlUsd: 1_200_000_000 },
  { pool: "kamino-jitosol",   project: "kamino",   symbol: "JITOSOL",     apy:  7.80, tvlUsd:    95_000_000 },
  { pool: "drift-usdc",       project: "drift",    symbol: "USDC",        apy:  8.92, tvlUsd:    75_000_000 },
  { pool: "orca-sol-usdc",    project: "orca",     symbol: "SOL-USDC",    apy: 22.40, tvlUsd:    60_000_000 },
  { pool: "raydium-sol-usdc", project: "raydium",  symbol: "SOL-USDC",    apy: 24.10, tvlUsd:    84_000_000 },
  { pool: "marginfi-sol",     project: "marginfi", symbol: "SOL",         apy:  6.20, tvlUsd:   140_000_000 },
  { pool: "kamino-pyusd",     project: "kamino",   symbol: "PYUSD",       apy: 12.30, tvlUsd:    38_000_000 },
  { pool: "jupiter-perps",    project: "jupiter",  symbol: "JLP-PERP",    apy: 19.80, tvlUsd:   210_000_000 },
  { pool: "meteora-usdc",     project: "meteora",  symbol: "USDC-USDT",   apy:  5.40, tvlUsd:    28_000_000 },
]);

export function LiveStrip(): JSX.Element {
  return <Marquee items={MARQUEE_SEED} />;
}

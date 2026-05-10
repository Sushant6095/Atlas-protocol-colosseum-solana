// Mock Birdeye intelligence — whale txs + volume anomalies. Phase 1
// swaps to /defi/txs/largest + /defi/price endpoints.

export type WhaleTxMock = {
  token: string;
  side: "BUY" | "SELL";
  usd: number;
  minutesAgo: number;
};

export type TokenStatMock = {
  symbol: string;
  priceUsd: number;
  change24hPct: number;
  volume24hUsd: number;
  volumeAvg7dUsd: number;
  // derived flag used by the volume-anomaly badge
  volumeAnomaly: boolean;
};

export const MOCK_WHALES: WhaleTxMock[] = [
  { token: "JitoSOL", side: "BUY",  usd: 1_240_000, minutesAgo:  6 },
  { token: "PYUSD",   side: "SELL", usd:   820_000, minutesAgo: 14 },
  { token: "JLP",     side: "BUY",  usd: 2_010_000, minutesAgo: 31 },
  { token: "USDC",    side: "BUY",  usd:   640_000, minutesAgo: 42 },
  { token: "JitoSOL", side: "SELL", usd:   980_000, minutesAgo: 58 },
];

export const MOCK_TOKEN_STATS: TokenStatMock[] = [
  { symbol: "USDC",    priceUsd: 1.000,   change24hPct:  0.01, volume24hUsd:  98_000_000, volumeAvg7dUsd:  85_000_000, volumeAnomaly: false },
  { symbol: "JitoSOL", priceUsd: 182.40,  change24hPct: -2.14, volume24hUsd: 142_000_000, volumeAvg7dUsd:  44_000_000, volumeAnomaly: true  },
  { symbol: "PYUSD",   priceUsd: 1.000,   change24hPct:  0.00, volume24hUsd:  12_000_000, volumeAvg7dUsd:  10_500_000, volumeAnomaly: false },
  { symbol: "JLP",     priceUsd:  4.812,  change24hPct:  3.42, volume24hUsd:  68_000_000, volumeAvg7dUsd:  21_000_000, volumeAnomaly: true  },
];

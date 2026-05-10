// Mock Kamino positions — shape mirrors what @kamino-finance/klend-sdk
// (or kamino-sdk) returns per-vault for an owner. Phase 1 swaps this
// for real SDK reads; the consuming components don't change.

export type KaminoPositionMock = {
  id: string;
  vaultName: string;
  strategyLabel: string;
  underlyingSymbol: string;
  underlyingMint: string;
  principalUsd: number;
  currentUsd: number;
  apyPct: number;
  lastRebalanceMinutesAgo: number;
  rebalanceRecommended: boolean;
  // Token brand color (used for accent on card)
  brandColor: string;
};

export const MOCK_POSITIONS: KaminoPositionMock[] = [
  {
    id: "kvault-usdc-main",
    vaultName: "Kamino USDC Main",
    strategyLabel: "JLP-leverage · auto-rebalance",
    underlyingSymbol: "USDC",
    underlyingMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    principalUsd: 25_000,
    currentUsd: 26_412.55,
    apyPct: 11.84,
    lastRebalanceMinutesAgo: 22,
    rebalanceRecommended: false,
    brandColor: "#3CE39A",
  },
  {
    id: "kvault-jitosol",
    vaultName: "Kamino JitoSOL Multiply",
    strategyLabel: "LST-leverage · jito",
    underlyingSymbol: "JitoSOL",
    underlyingMint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    principalUsd: 10_000,
    currentUsd: 9_812.30,
    apyPct: 7.80,
    lastRebalanceMinutesAgo: 4,
    rebalanceRecommended: true,
    brandColor: "#A682FF",
  },
  {
    id: "kvault-pyusd",
    vaultName: "Kamino PYUSD Lend",
    strategyLabel: "stable-lend · single-asset",
    underlyingSymbol: "PYUSD",
    underlyingMint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    principalUsd: 8_000,
    currentUsd: 8_182.10,
    apyPct: 12.30,
    lastRebalanceMinutesAgo: 96,
    rebalanceRecommended: false,
    brandColor: "#76E4F7",
  },
  {
    id: "kvault-jlp-perp",
    vaultName: "Kamino JLP Boost",
    strategyLabel: "perps-fee capture",
    underlyingSymbol: "JLP",
    underlyingMint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
    principalUsd: 15_000,
    currentUsd: 16_847.40,
    apyPct: 19.80,
    lastRebalanceMinutesAgo: 11,
    rebalanceRecommended: true,
    brandColor: "#F7B955",
  },
];

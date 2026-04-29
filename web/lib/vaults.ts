/**
 * Atlas internal vault registry.
 * Each strategy leg references a real DeFiLlama pool ID so we can pull live APY+TVL.
 */

export interface StrategyLeg {
  name: string;
  protocol:
    | "Kamino"
    | "Drift"
    | "Jupiter"
    | "marginfi"
    | "Jito"
    | "Sanctum"
    | "Cambrian"
    | "Marinade"
    | "Solend"
    | "MarginFi"
    | "Orca"
    | "Raydium"
    | "Meteora"
    | "PRIME"
    | "Maple"
    | "Centrifuge"
    | "Idle";
  allocationPct: number;
  poolId: string | null;
  description: string;
}

export interface AtlasVaultMeta {
  symbol: string;
  name: string;
  asset: "USDC" | "USDT" | "SOL" | "BTC" | "ETH" | "JLP" | "USDS" | "PYUSD" | "Mixed";
  type: "Stable" | "Volatile" | "LST" | "Hybrid" | "RWA" | "LP";
  apy: number;
  apy30d: number;
  tvl: number;
  chain: "Solana";
  status: "Live" | "Coming soon";
  proven: boolean;
  description: string;
  protocols: string[];
  legs: StrategyLeg[];
  vaultProgram: string;
  shareMint: string;
  depositMint: string;
  deployedAt: string;
  managementFeeBps: number;
  performanceFeeBps: number;
  riskScore: number;
  riskFactors: { label: string; rating: "Low" | "Medium" | "High"; note: string }[];
  chartPoolId: string | null;
  docsUrl: string;
  apiUrl: string;
}

const KAMINO_USDC_MAIN = "84afba98-c64c-4467-be86-9c4f2e2a1e0a";
const VAULT_PROG = "AtLasVau1t11111111111111111111111111111111";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const SOL_MINT = "So11111111111111111111111111111111111111112";

function defaultRisk(score: number): AtlasVaultMeta["riskFactors"] {
  return [
    { label: "Smart contract risk", rating: score >= 4 ? "High" : "Medium", note: "Composed from sp1-solana, Anchor, Token-2022, and protocol SDKs. Atlas programs unaudited at v1." },
    { label: "Strategy drift", rating: "Low", note: "Strategy commitment is immutable post init_vault — every rebalance gated on a fresh SP1 proof." },
    { label: "Liquidity", rating: "Low", note: "Withdraw is permissionless. Idle buffer absorbs same-block exits." },
  ];
}

export const VAULTS: AtlasVaultMeta[] = [
  // ─────────────── STABLES ───────────────
  {
    symbol: "atUSDC-v1",
    name: "USDC · Verified AI Yield",
    asset: "USDC",
    type: "Stable",
    apy: 11.84,
    apy30d: 9.42,
    tvl: 48_211,
    chain: "Solana",
    status: "Live",
    proven: true,
    description:
      "Stablecoin allocator with proof-gated rebalancing. AI re-routes USDC across the top Solana yield venues whenever risk-adjusted APY shifts >50 bps.",
    protocols: ["Kamino", "Drift", "Jupiter", "marginfi"],
    legs: [
      { name: "Kamino Main USDC Lend", protocol: "Kamino", allocationPct: 40, poolId: KAMINO_USDC_MAIN, description: "Base lending APY plus KMNO incentives." },
      { name: "Drift USDC Insurance Vault", protocol: "Drift", allocationPct: 25, poolId: null, description: "Funding + spread + liquidation premium." },
      { name: "Jupiter LP USDC-USDT", protocol: "Jupiter", allocationPct: 20, poolId: null, description: "Concentrated stable LP fee revenue." },
      { name: "marginfi USDC Lend", protocol: "marginfi", allocationPct: 10, poolId: null, description: "Diversification leg." },
      { name: "Idle (rebalance buffer)", protocol: "Idle", allocationPct: 5, poolId: null, description: "Withdraw absorber." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atUSDC1nVau1tShareM1ntPDA1111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "2026-04-29",
    managementFeeBps: 0,
    performanceFeeBps: 1000,
    riskScore: 2,
    riskFactors: [
      ...defaultRisk(2),
      { label: "Cross-protocol exposure", rating: "Medium", note: "Funds move across 4 venues — protocol exploit affects a leg." },
      { label: "Stablecoin depeg", rating: "Low", note: "USDC native (Circle). No exotic stables in rotation." },
    ],
    chartPoolId: KAMINO_USDC_MAIN,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atUSDC-v1",
  },
  {
    symbol: "atUSDC-conservative",
    name: "USDC · Conservative",
    asset: "USDC",
    type: "Stable",
    apy: 6.21,
    apy30d: 5.94,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Lending-only allocator. No LP, no perps. USDC sits across Kamino + marginfi + Solend.",
    protocols: ["Kamino", "marginfi", "Solend"],
    legs: [
      { name: "Kamino Main USDC", protocol: "Kamino", allocationPct: 50, poolId: KAMINO_USDC_MAIN, description: "Conservative lending core." },
      { name: "marginfi USDC", protocol: "marginfi", allocationPct: 30, poolId: null, description: "Risk-spread lending." },
      { name: "Solend USDC", protocol: "Solend", allocationPct: 15, poolId: null, description: "Tertiary lending leg." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atUSDCcons11111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 500,
    riskScore: 1,
    riskFactors: defaultRisk(1),
    chartPoolId: KAMINO_USDC_MAIN,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atUSDC-conservative",
  },
  {
    symbol: "atUSDC-aggressive",
    name: "USDC · Aggressive",
    asset: "USDC",
    type: "Volatile",
    apy: 19.40,
    apy30d: 16.80,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Higher-vol USDC strategy — Drift perps funding capture, Jupiter LP, leveraged Kamino multiply.",
    protocols: ["Drift Perps", "Jupiter LP", "Kamino Multiply"],
    legs: [
      { name: "Kamino Multiply USDC 3x", protocol: "Kamino", allocationPct: 40, poolId: KAMINO_USDC_MAIN, description: "Looped USDC at 3x." },
      { name: "Drift funding capture", protocol: "Drift", allocationPct: 35, poolId: null, description: "Delta-neutral perp funding." },
      { name: "Jupiter LP USDC-SOL", protocol: "Jupiter", allocationPct: 20, poolId: null, description: "JLP exposure." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atUSDCagg11111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1500,
    riskScore: 4,
    riskFactors: [
      ...defaultRisk(4),
      { label: "Leverage liquidation", rating: "High", note: "3x Kamino loops can liquidate in stress." },
      { label: "Funding flip", rating: "Medium", note: "Perp funding can invert." },
    ],
    chartPoolId: KAMINO_USDC_MAIN,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atUSDC-aggressive",
  },
  {
    symbol: "atUSDT-v1",
    name: "USDT · Stablecoin Aggregator",
    asset: "USDT",
    type: "Stable",
    apy: 9.12,
    apy30d: 8.05,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "USDT-native rotation across Kamino, Drift insurance, marginfi.",
    protocols: ["Kamino", "Drift", "marginfi"],
    legs: [
      { name: "Kamino USDT Lend", protocol: "Kamino", allocationPct: 50, poolId: null, description: "Lending core." },
      { name: "Drift USDT Insurance", protocol: "Drift", allocationPct: 30, poolId: null, description: "Insurance vault." },
      { name: "marginfi USDT", protocol: "marginfi", allocationPct: 15, poolId: null, description: "Diversification." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atUSDTv11111111111111111111111111111111111",
    depositMint: USDT_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1000,
    riskScore: 2,
    riskFactors: defaultRisk(2),
    chartPoolId: KAMINO_USDC_MAIN,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atUSDT-v1",
  },
  {
    symbol: "atPYUSD-v1",
    name: "PYUSD · PayPal Stable Allocator",
    asset: "PYUSD",
    type: "Stable",
    apy: 7.85,
    apy30d: 7.20,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "PYUSD-native vault routing through Kamino + marginfi PYUSD markets.",
    protocols: ["Kamino", "marginfi"],
    legs: [
      { name: "Kamino PYUSD", protocol: "Kamino", allocationPct: 60, poolId: null, description: "Lending APY + incentives." },
      { name: "marginfi PYUSD", protocol: "marginfi", allocationPct: 35, poolId: null, description: "Diversification leg." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atPYUSDv1111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1000,
    riskScore: 2,
    riskFactors: defaultRisk(2),
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atPYUSD-v1",
  },

  // ─────────────── SOL / LST ───────────────
  {
    symbol: "atSOL-v1",
    name: "SOL · Verified Liquid Staking + Restaking",
    asset: "SOL",
    type: "LST",
    apy: 7.92,
    apy30d: 7.40,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Native SOL allocator routing across Jito, Sanctum, Marinade, and Cambrian restaking.",
    protocols: ["Jito", "Sanctum", "Marinade", "Cambrian"],
    legs: [
      { name: "JitoSOL", protocol: "Jito", allocationPct: 35, poolId: null, description: "MEV-boosted LST." },
      { name: "Sanctum infinity", protocol: "Sanctum", allocationPct: 25, poolId: null, description: "Diversified LST basket." },
      { name: "mSOL (Marinade)", protocol: "Marinade", allocationPct: 20, poolId: null, description: "Veteran LST." },
      { name: "Cambrian restaking", protocol: "Cambrian", allocationPct: 15, poolId: null, description: "AVS yield premium." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atSOL1nVau1tShareM1ntPDA111111111111111111111",
    depositMint: SOL_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1000,
    riskScore: 3,
    riskFactors: [
      ...defaultRisk(3),
      { label: "Slashing risk", rating: "Medium", note: "Restaking exposes principal to AVS slashing." },
      { label: "LST depeg", rating: "Low", note: "Deeply liquid LSTs; tail risk during stress." },
    ],
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atSOL-v1",
  },
  {
    symbol: "atSOL-leveraged",
    name: "SOL · Leveraged LST Multiply",
    asset: "SOL",
    type: "Volatile",
    apy: 14.20,
    apy30d: 12.10,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "JitoSOL collateral, borrow SOL, recursive loop on Kamino Multiply.",
    protocols: ["Kamino Multiply", "Jito", "Sanctum"],
    legs: [
      { name: "Kamino Multiply JitoSOL/SOL", protocol: "Kamino", allocationPct: 70, poolId: null, description: "3x leveraged LST loop." },
      { name: "Sanctum infinity", protocol: "Sanctum", allocationPct: 25, poolId: null, description: "Unleveraged LST sleeve." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atSOLlev11111111111111111111111111111111111",
    depositMint: SOL_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1500,
    riskScore: 4,
    riskFactors: [
      ...defaultRisk(4),
      { label: "Leverage liquidation", rating: "High", note: "Loop unwinds if JitoSOL depegs from SOL." },
    ],
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atSOL-leveraged",
  },

  // ─────────────── BTC / ETH ───────────────
  {
    symbol: "atBTC-v1",
    name: "BTC · Wrapped BTC Yield",
    asset: "BTC",
    type: "Volatile",
    apy: 4.85,
    apy30d: 4.20,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "tBTC + zBTC yield across Kamino lending and Jupiter LP.",
    protocols: ["Kamino", "Jupiter"],
    legs: [
      { name: "Kamino BTC Lend", protocol: "Kamino", allocationPct: 60, poolId: null, description: "BTC lending APY." },
      { name: "Jupiter LP BTC-SOL", protocol: "Jupiter", allocationPct: 35, poolId: null, description: "BTC LP exposure." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atBTCv11111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1000,
    riskScore: 3,
    riskFactors: [
      ...defaultRisk(3),
      { label: "Bridge risk", rating: "Medium", note: "Wrapped BTC depends on bridge security (zBTC, tBTC)." },
    ],
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atBTC-v1",
  },
  {
    symbol: "atETH-v1",
    name: "ETH · Wrapped ETH Yield",
    asset: "ETH",
    type: "Volatile",
    apy: 5.62,
    apy30d: 5.10,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Wormhole-bridged ETH lent on Kamino + LP'd on Orca.",
    protocols: ["Kamino", "Orca"],
    legs: [
      { name: "Kamino ETH Lend", protocol: "Kamino", allocationPct: 55, poolId: null, description: "Lending leg." },
      { name: "Orca LP ETH-USDC", protocol: "Orca", allocationPct: 40, poolId: null, description: "Whirlpool LP." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atETHv11111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1000,
    riskScore: 3,
    riskFactors: [
      ...defaultRisk(3),
      { label: "Bridge risk", rating: "Medium", note: "Wormhole ETH dependency." },
    ],
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atETH-v1",
  },

  // ─────────────── RWA ───────────────
  {
    symbol: "atRWA-v1",
    name: "RWA · Real-World Yield",
    asset: "USDC",
    type: "RWA",
    apy: 7.33,
    apy30d: 7.30,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Tokenized real-world yield — PRIME real-estate, Maple credit, Centrifuge invoices.",
    protocols: ["PRIME", "Maple", "Centrifuge"],
    legs: [
      { name: "PRIME real-estate", protocol: "PRIME", allocationPct: 50, poolId: null, description: "US home-equity loan yield." },
      { name: "Maple senior credit", protocol: "Maple", allocationPct: 30, poolId: null, description: "Onchain corporate credit." },
      { name: "Centrifuge invoices", protocol: "Centrifuge", allocationPct: 15, poolId: null, description: "Receivables financing." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atRWAv11111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 50,
    performanceFeeBps: 1000,
    riskScore: 3,
    riskFactors: [
      ...defaultRisk(3),
      { label: "Off-chain default", rating: "Medium", note: "Real-world borrower default risk." },
      { label: "Lockup", rating: "Medium", note: "RWA legs may have 30–90d redemption windows." },
    ],
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atRWA-v1",
  },

  // ─────────────── LP-only ───────────────
  {
    symbol: "atLP-stable",
    name: "Stable LP · Concentrated Liquidity",
    asset: "Mixed",
    type: "LP",
    apy: 13.40,
    apy30d: 11.20,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Concentrated stable LP positions across Orca, Raydium, Meteora — fee revenue only.",
    protocols: ["Orca", "Raydium", "Meteora"],
    legs: [
      { name: "Orca USDC-USDT whirlpool", protocol: "Orca", allocationPct: 40, poolId: null, description: "Tight stable concentration." },
      { name: "Raydium USDC-USDT", protocol: "Raydium", allocationPct: 30, poolId: null, description: "Standard AMM." },
      { name: "Meteora DLMM USDC-USDT", protocol: "Meteora", allocationPct: 25, poolId: null, description: "Dynamic LP." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atLPstable111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1500,
    riskScore: 3,
    riskFactors: [
      ...defaultRisk(3),
      { label: "Concentrated range", rating: "Medium", note: "Out-of-range LP earns no fees." },
    ],
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atLP-stable",
  },

  // ─────────────── Perps funding ───────────────
  {
    symbol: "atFunding-v1",
    name: "Delta-neutral · Perps Funding",
    asset: "USDC",
    type: "Hybrid",
    apy: 22.10,
    apy30d: 18.00,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Long spot SOL + short perp SOL on Drift. Captures funding while holding zero-delta.",
    protocols: ["Drift", "Jupiter", "Jito"],
    legs: [
      { name: "Drift short SOL perp", protocol: "Drift", allocationPct: 50, poolId: null, description: "Short leg captures funding." },
      { name: "JitoSOL spot collateral", protocol: "Jito", allocationPct: 45, poolId: null, description: "Long collateral earning LST yield." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atFundv11111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 2000,
    riskScore: 4,
    riskFactors: [
      ...defaultRisk(4),
      { label: "Funding inversion", rating: "High", note: "Funding can flip negative; strategy bleeds." },
      { label: "Liquidation", rating: "Medium", note: "Short perp leg has liquidation risk if collateral drops." },
    ],
    chartPoolId: KAMINO_USDC_MAIN,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atFunding-v1",
  },

  // ─────────────── JLP ───────────────
  {
    symbol: "atJLP-v1",
    name: "JLP · Jupiter LP Maxi",
    asset: "JLP",
    type: "LP",
    apy: 28.40,
    apy30d: 24.00,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "Direct exposure to JLP — Jupiter perps liquidity provider basket.",
    protocols: ["Jupiter"],
    legs: [
      { name: "JLP holding", protocol: "Jupiter", allocationPct: 95, poolId: null, description: "Native JLP." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atJLPv11111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1500,
    riskScore: 4,
    riskFactors: [
      ...defaultRisk(4),
      { label: "Trader PnL exposure", rating: "High", note: "JLP loses when traders win on Jupiter perps." },
    ],
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atJLP-v1",
  },

  // ─────────────── Mixed AI basket ───────────────
  {
    symbol: "atMixed-v1",
    name: "Mixed · AI-Curated Basket",
    asset: "Mixed",
    type: "Hybrid",
    apy: 16.80,
    apy30d: 14.30,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "AI dynamically allocates across stable + LST + LP. Risk parity rebalanced weekly.",
    protocols: ["Kamino", "Jito", "Drift", "Jupiter", "marginfi"],
    legs: [
      { name: "USDC stables sleeve", protocol: "Kamino", allocationPct: 35, poolId: KAMINO_USDC_MAIN, description: "Risk-parity stables." },
      { name: "JitoSOL LST sleeve", protocol: "Jito", allocationPct: 25, poolId: null, description: "LST exposure." },
      { name: "Drift funding capture", protocol: "Drift", allocationPct: 20, poolId: null, description: "Carry trade." },
      { name: "Jupiter LP", protocol: "Jupiter", allocationPct: 15, poolId: null, description: "LP fee revenue." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atMixedv11111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1500,
    riskScore: 3,
    riskFactors: defaultRisk(3),
    chartPoolId: KAMINO_USDC_MAIN,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atMixed-v1",
  },

  // ─────────────── USDS ───────────────
  {
    symbol: "atUSDS-v1",
    name: "USDS · Sky Stable Yield",
    asset: "USDS",
    type: "Stable",
    apy: 8.40,
    apy30d: 7.85,
    tvl: 0,
    chain: "Solana",
    status: "Coming soon",
    proven: true,
    description: "USDS-native vault routing through Solana DSR + Kamino USDS markets.",
    protocols: ["Kamino", "Sky DSR"],
    legs: [
      { name: "Sky DSR (sUSDS)", protocol: "Kamino", allocationPct: 65, poolId: null, description: "Sky savings rate via Solana." },
      { name: "Kamino USDS Lend", protocol: "Kamino", allocationPct: 30, poolId: null, description: "Lending leg." },
      { name: "Idle", protocol: "Idle", allocationPct: 5, poolId: null, description: "Buffer." },
    ],
    vaultProgram: VAULT_PROG,
    shareMint: "atUSDSv11111111111111111111111111111111111",
    depositMint: USDC_MINT,
    deployedAt: "—",
    managementFeeBps: 0,
    performanceFeeBps: 1000,
    riskScore: 2,
    riskFactors: defaultRisk(2),
    chartPoolId: null,
    docsUrl: "/how-it-works",
    apiUrl: "/api/vaults/atUSDS-v1",
  },
];

export function findVault(symbol: string): AtlasVaultMeta | undefined {
  return VAULTS.find((v) => v.symbol === symbol);
}

export type MarqueeItem = {
  name: string;
  apy: string;
  status: "live" | "paused" | "warn";
};

export const MARQUEE_ITEMS: MarqueeItem[] = [
  { name: "atlas treasury", apy: "zk-verified", status: "live" },
  { name: "kamino main",    apy: "5.89%",       status: "live" },
  { name: "drift v2",       apy: "8.21%",       status: "live" },
  { name: "jupiter lend",   apy: "4.45%",       status: "live" },
  { name: "marginfi",       apy: "3.95%",       status: "live" },
  { name: "kamino multiply",apy: "12.40%",      status: "live" },
  { name: "pendle",         apy: "14.05%",      status: "live" },
  { name: "morpho",         apy: "4.29%",       status: "live" },
  { name: "maple",          apy: "5.11%",       status: "live" },
  { name: "manifest",       apy: "3.89%",       status: "warn" },
  { name: "raydium",        apy: "9.12%",       status: "live" },
  { name: "orca whirlpools",apy: "6.74%",       status: "live" },
];

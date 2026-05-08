export type Partner = {
  name: string;
  slug: string;          // file-system safe id, used for /brand/protocols/{slug}.svg
  domain: string | null; // brandfetch lookup; null = no logo source, render text mark
  color: string;         // brand hex color (used for halo + text fallback)
  category: "substrate" | "data" | "defi" | "treasury" | "privacy" | "tooling";
  href: string;
};

export const PARTNERS: Partner[] = [
  // SUBSTRATE
  { name: "Solana",         slug: "solana",         domain: "solana.com",          color: "#14F195", category: "substrate", href: "/docs/integrations/solana" },
  { name: "Succinct SP1",   slug: "succinct",       domain: "succinct.xyz",        color: "#FE11C5", category: "substrate", href: "/docs/integrations/succinct-sp1" },
  { name: "Anchor",         slug: "anchor",         domain: "anchor-lang.com",     color: "#512DA8", category: "substrate", href: "/docs/integrations/anchor" },
  { name: "Pinocchio",      slug: "pinocchio",      domain: null,                  color: "#8F4DFF", category: "substrate", href: "/docs/integrations/pinocchio" },
  { name: "Light Protocol", slug: "light-protocol", domain: "lightprotocol.com",   color: "#00D2FF", category: "substrate", href: "/docs/integrations/light-protocol" },

  // DATA + ORACLES
  { name: "Helius",         slug: "helius",         domain: "helius.dev",          color: "#0E76FD", category: "data",      href: "/docs/integrations/helius" },
  { name: "Triton One",     slug: "triton",         domain: "triton.one",          color: "#7C5CFF", category: "data",      href: "/docs/integrations/triton" },
  { name: "QuickNode",      slug: "quicknode",      domain: "quicknode.com",       color: "#F73900", category: "data",      href: "/docs/integrations/quicknode" },
  { name: "RPC Fast",       slug: "rpc-fast",       domain: "rpcfast.com",         color: "#3CE39A", category: "data",      href: "/docs/integrations/rpc-fast" },
  { name: "Pyth",           slug: "pyth",           domain: "pyth.network",        color: "#B084F2", category: "data",      href: "/docs/integrations/pyth" },
  { name: "Switchboard",    slug: "switchboard",    domain: "switchboard.xyz",     color: "#3CE39A", category: "data",      href: "/docs/integrations/switchboard" },
  { name: "Birdeye",        slug: "birdeye",        domain: "birdeye.so",          color: "#FFAA00", category: "data",      href: "/docs/integrations/birdeye" },
  { name: "Dune",           slug: "dune",           domain: "dune.com",            color: "#F0552B", category: "data",      href: "/docs/integrations/dune" },

  // DEFI VENUES
  { name: "Kamino",         slug: "kamino",         domain: "kamino.finance",      color: "#16C394", category: "defi",      href: "/docs/integrations/kamino" },
  { name: "Drift",          slug: "drift",          domain: "drift.trade",         color: "#19FB9B", category: "defi",      href: "/docs/integrations/drift" },
  { name: "Jupiter",        slug: "jupiter",        domain: "jup.ag",              color: "#FFB800", category: "defi",      href: "/docs/integrations/jupiter" },
  { name: "Marginfi",       slug: "marginfi",       domain: "marginfi.com",        color: "#E5FF50", category: "defi",      href: "/docs/integrations/marginfi" },
  { name: "Jito",           slug: "jito",           domain: "jito.network",        color: "#99FFB3", category: "defi",      href: "/docs/integrations/jito" },
  { name: "DFlow",          slug: "dflow",          domain: "dflow.net",           color: "#FF5CF0", category: "defi",      href: "/docs/integrations/dflow" },

  // TREASURY
  { name: "Dodo Payments",  slug: "dodo",           domain: "dodopayments.com",    color: "#FFE600", category: "treasury",  href: "/docs/integrations/dodo" },
  { name: "Palm USD",       slug: "pusd",           domain: "paxos.com",           color: "#A682FF", category: "treasury",  href: "/docs/integrations/pusd" },
  { name: "Squads",         slug: "squads",         domain: "squads.so",           color: "#4F46E5", category: "treasury",  href: "/docs/integrations/squads" },
  { name: "Solflare",       slug: "solflare",       domain: "solflare.com",        color: "#F2A93B", category: "treasury",  href: "/docs/integrations/solflare" },

  // PRIVACY
  { name: "Cloak",          slug: "cloak",          domain: null,                  color: "#9F7AEA", category: "privacy",   href: "/docs/integrations/cloak" },
  { name: "MagicBlock",     slug: "magicblock",     domain: "magicblock.gg",       color: "#FF6166", category: "privacy",   href: "/docs/integrations/magicblock" },

  // TOOLING / AI
  { name: "Tether QVAC",    slug: "tether",         domain: "tether.to",           color: "#009393", category: "tooling",   href: "/docs/integrations/tether-qvac" },
  { name: "Bubblegum",      slug: "bubblegum",      domain: "metaplex.com",        color: "#E879F9", category: "tooling",   href: "/docs/integrations/bubblegum" },
];

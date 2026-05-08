// Single source of truth for the /docs surface.
//
// Drives the top tab strip, the left sidebar, and the search index.
// Every entry in `SIDEBAR` belongs to exactly one tab; the tab strip
// derives its tab list from `TABS` and clicking a tab switches the
// sidebar's filtered section set.
//
// Every leaf `href` must resolve to a real route — either an
// existing /docs page or a stub generated for this PR.

export type DocTabId =
  | "overview"
  | "protocol"
  | "vault"
  | "treasury"
  | "developers"
  | "integrations"
  | "philosophy";

export interface DocItem {
  href: string;
  label: string;
  /** One-line description used by search + sidebar tooltip. */
  blurb?: string;
}

export interface DocSection {
  /** Visible group header in the sidebar. */
  title: string;
  items: DocItem[];
}

export interface DocTab {
  id: DocTabId;
  label: string;
}

export const TABS: ReadonlyArray<DocTab> = [
  { id: "overview",     label: "Overview" },
  { id: "protocol",     label: "Protocol" },
  { id: "vault",        label: "Vault" },
  { id: "treasury",     label: "Treasury OS" },
  { id: "developers",   label: "Developers" },
  { id: "integrations", label: "Integrations" },
  { id: "philosophy",   label: "Philosophy" },
];

export const SIDEBAR: Record<DocTabId, DocSection[]> = {
  overview: [
    {
      title: "Get started",
      items: [
        { href: "/docs",                label: "Welcome",          blurb: "Documentation home." },
        { href: "/docs/how-it-works",   label: "How Atlas works",  blurb: "From deposit to verified rebalance." },
        { href: "/docs/quickstart",     label: "Quickstart",       blurb: "Five-minute path to a verified deposit." },
      ],
    },
  ],

  protocol: [
    {
      title: "On-chain primitive",
      items: [
        { href: "/docs/protocol",                label: "Overview",            blurb: "What the program does and why." },
        { href: "/docs/protocol/verifier-cpi",   label: "Verifier as a public good", blurb: "Open verify-inference CPI any program can call." },
        { href: "/docs/protocol/public-input",   label: "Public input layout", blurb: "The 268-byte v2 layout, byte by byte." },
        { href: "/docs/protocol/invariants",     label: "Invariants I-1 to I-26", blurb: "What the protocol promises." },
        { href: "/docs/protocol/threat-model",   label: "Threat model",        blurb: "Adversarial cases, what breaks, what doesn't." },
      ],
    },
  ],

  vault: [
    {
      title: "Vault product",
      items: [
        { href: "/docs/vault",                       label: "Overview",            blurb: "Atlas Vault for depositors." },
        { href: "/docs/vault/deposit-withdraw",      label: "Deposit & withdraw",  blurb: "Flow, fees, settlement." },
        { href: "/docs/vault/rebalance-flow",        label: "Rebalance pipeline",  blurb: "Sixteen stages from intent to receipt." },
        { href: "/docs/vault/proof-verification",    label: "Verify in browser",   blurb: "Run the verifier client-side." },
        { href: "/docs/vault/confidential-mode",     label: "Confidential mode",   blurb: "Token-2022 confidential transfers." },
        { href: "/docs/vault/private-execution",     label: "Private execution",   blurb: "MagicBlock PER for sensitive flow." },
      ],
    },
  ],

  treasury: [
    {
      title: "Treasury OS",
      items: [
        { href: "/docs/treasury",                    label: "Overview",            blurb: "Atlas as a treasury operating system." },
        { href: "/docs/treasury/treasury-entity",    label: "Treasury entity",     blurb: "Squads multisig + KYB onboarding." },
        { href: "/docs/treasury/payment-prewarm",    label: "Payment pre-warm",    blurb: "Cashflow-aware buffer." },
        { href: "/docs/treasury/runway-forecast",    label: "Runway forecast",     blurb: "Months-of-runway under load." },
        { href: "/docs/treasury/invoices",           label: "Invoices",            blurb: "OCR + invoice intelligence." },
        { href: "/docs/treasury/unified-ledger",     label: "Unified ledger",      blurb: "Audit-ready timeline." },
      ],
    },
  ],

  developers: [
    {
      title: "Reference",
      items: [
        { href: "/docs/api",                  label: "REST API",          blurb: "REST + WebSocket reference." },
        { href: "/docs/sdk",                  label: "SDK overview",      blurb: "TypeScript and Rust SDKs." },
        { href: "/docs/sdk/typescript",       label: "@atlas/sdk",        blurb: "Browser + Node TypeScript SDK." },
        { href: "/docs/sdk/rust",             label: "atlas-rs",          blurb: "Rust SDK and PDA helpers." },
        { href: "/docs/sdk/verify-proof",     label: "Verify a proof",    blurb: "Client-side Groth16 verify." },
      ],
    },
    {
      title: "Tooling",
      items: [
        { href: "/docs/playground",           label: "API playground",    blurb: "Interactive request console." },
        { href: "/docs/webhooks",             label: "Webhooks",          blurb: "Signed payloads + replay window." },
        { href: "/docs/shortcuts",            label: "Keyboard shortcuts",blurb: "Printable cheat sheet." },
      ],
    },
  ],

  integrations: [
    {
      title: "Yield venues",
      items: [
        { href: "/docs/integrations",            label: "All integrations",  blurb: "Index of every connected venue." },
        { href: "/docs/integrations/kamino",     label: "Kamino",            blurb: "Kamino CPI integration." },
        { href: "/docs/integrations/drift",      label: "Drift",             blurb: "Drift CPI." },
        { href: "/docs/integrations/jupiter",    label: "Jupiter",           blurb: "Trigger, Recurring, Lend." },
        { href: "/docs/integrations/marginfi",   label: "marginfi",          blurb: "marginfi CPI." },
      ],
    },
    {
      title: "Treasury & assets",
      items: [
        { href: "/docs/integrations/dodo",       label: "Dodo Payments",     blurb: "Treasury payment rails." },
        { href: "/docs/integrations/pusd",       label: "Palm USD",          blurb: "Reserve asset." },
        { href: "/docs/integrations/cloak",      label: "Cloak",             blurb: "Confidential treasury." },
        { href: "/docs/integrations/magicblock", label: "MagicBlock",        blurb: "Private execution rooms." },
      ],
    },
    {
      title: "Proofs & infra",
      items: [
        { href: "/docs/integrations/succinct-sp1", label: "Succinct SP1",   blurb: "SP1 zkVM + verifier." },
        { href: "/docs/integrations/helius",       label: "Helius",         blurb: "Yellowstone gRPC." },
        { href: "/docs/integrations/triton",       label: "Triton",         blurb: "gRPC quorum partner." },
        { href: "/docs/integrations/quicknode",    label: "QuickNode",      blurb: "Fee oracle + WSS stream." },
        { href: "/docs/integrations/rpc-fast",     label: "RPC Fast",       blurb: "Latency tier-A RPC." },
        { href: "/docs/integrations/jito",         label: "Jito",           blurb: "Block engine." },
      ],
    },
    {
      title: "Oracles",
      items: [
        { href: "/docs/integrations/pyth",         label: "Pyth",           blurb: "Pull oracle." },
        { href: "/docs/integrations/switchboard",  label: "Switchboard",    blurb: "On-Demand oracle." },
      ],
    },
  ],

  philosophy: [
    {
      title: "Beliefs",
      items: [
        { href: "/docs/philosophy",                            label: "Overview",                  blurb: "How Atlas thinks." },
        { href: "/docs/philosophy/why-we-built-this",          label: "Why we built this",         blurb: "The thesis." },
        { href: "/docs/philosophy/the-26-invariants",          label: "The 26 invariants",         blurb: "Each promise, in plain language." },
        { href: "/docs/philosophy/engineering-discipline",     label: "Engineering discipline",    blurb: "No unwrap, no clock-now, no shortcuts." },
        { href: "/docs/philosophy/what-we-refused-to-build",   label: "What we refused to build",  blurb: "The cuts list." },
      ],
    },
  ],
};

/** Flat list of every item — used by search + breadcrumb resolver. */
export const FLAT_ITEMS: ReadonlyArray<DocItem & { tab: DocTabId }> =
  (Object.entries(SIDEBAR) as [DocTabId, DocSection[]][])
    .flatMap(([tab, sections]) =>
      sections.flatMap((s) => s.items.map((it) => ({ ...it, tab }))),
    );

/** Resolve which tab a route belongs to. Falls back to "overview". */
export function tabForPath(pathname: string): DocTabId {
  // Exact-match first to avoid /docs accidentally matching /docs/api etc.
  const exact = FLAT_ITEMS.find((it) => it.href === pathname);
  if (exact) return exact.tab;
  // Prefix match for nested routes that don't have a sidebar entry yet.
  const prefix = FLAT_ITEMS
    .filter((it) => it.href !== "/docs" && pathname.startsWith(it.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return prefix?.tab ?? "overview";
}

/** Find the active item for a given path (for breadcrumb labels). */
export function itemForPath(pathname: string): (DocItem & { tab: DocTabId }) | undefined {
  return FLAT_ITEMS.find((it) => it.href === pathname);
}

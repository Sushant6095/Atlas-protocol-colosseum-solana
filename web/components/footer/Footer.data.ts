export type FooterLink = { label: string; href: string; external?: boolean };
export type FooterColumn = { title: string; links: FooterLink[] };

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Vaults",         href: "/vaults" },
      { label: "Markets",        href: "/markets" },
      { label: "Treasury OS",    href: "/treasury" },
      { label: "Triggers",       href: "/triggers" },
      { label: "Recurring",      href: "/recurring" },
      { label: "Hedging",        href: "/hedging" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "Verifier CPI",       href: "/docs/protocol/verifier-cpi" },
      { label: "Public Input v2",    href: "/docs/protocol/public-input" },
      { label: "26 Invariants",      href: "/docs/philosophy/the-26-invariants" },
      { label: "Threat Model",       href: "/docs/protocol/threat-model" },
      { label: "Architecture",       href: "/architecture" },
      { label: "Security",           href: "/security" },
    ],
  },
  {
    title: "Verify",
    links: [
      { label: "Proof Explorer",     href: "/proofs" },
      { label: "Decision Engine",    href: "/decision-engine" },
      { label: "Infra Observatory",  href: "/infra" },
      { label: "Verify in Browser",  href: "/docs/sdk/verify-proof" },
      { label: "Audit Trail",        href: "/docs/treasury/unified-ledger" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "TypeScript SDK",     href: "https://www.npmjs.com/package/@atlas/sdk", external: true },
      { label: "Rust SDK",           href: "https://crates.io/crates/atlas-rs", external: true },
      { label: "REST API",           href: "/docs/api" },
      { label: "WebSocket Streams",  href: "/docs/api/streams" },
      { label: "Webhooks",           href: "/docs/webhooks" },
      { label: "Playground",         href: "/playground" },
      { label: "MCP Server",         href: "/docs/mcp" },
      { label: "GitHub",             href: "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana", external: true },
    ],
  },
  {
    title: "Integrations",
    links: [
      { label: "Solana",             href: "/docs/integrations/solana" },
      { label: "Succinct SP1",       href: "/docs/integrations/succinct-sp1" },
      { label: "Kamino",             href: "/docs/integrations/kamino" },
      { label: "Drift",              href: "/docs/integrations/drift" },
      { label: "Jupiter",            href: "/docs/integrations/jupiter" },
      { label: "Marginfi",           href: "/docs/integrations/marginfi" },
      { label: "Helius · Triton · QuickNode", href: "/docs/integrations/rpc-providers" },
      { label: "View all 27 →",      href: "/docs/integrations" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation",      href: "/docs" },
      { label: "Blog",               href: "/blog" },
      { label: "Changelog",          href: "/changelog" },
      { label: "Brand kit",          href: "/brand" },
      { label: "Glossary",           href: "/docs/glossary" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Why we built this",  href: "/docs/philosophy/why-we-built-this" },
      { label: "Roadmap",            href: "/roadmap" },
      { label: "Press",              href: "/press" },
      { label: "Careers",            href: "/careers" },
      { label: "Contact",            href: "mailto:hello@atlasfi.in", external: true },
    ],
  },
];

export const SOCIAL_LINKS = [
  { label: "X",        href: "https://x.com/atlasfi",       icon: "twitter" },
  { label: "GitHub",   href: "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana", icon: "github" },
  { label: "Discord",  href: "https://discord.gg/atlas",    icon: "discord" },
  { label: "Telegram", href: "https://t.me/atlasfi",        icon: "telegram" },
] as const;

export const LEGAL_LINKS = [
  { label: "Privacy Policy",  href: "/legal/privacy" },
  { label: "Terms of Service",href: "/legal/terms" },
  { label: "Apache-2.0",      href: "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/LICENSE", external: true },
];

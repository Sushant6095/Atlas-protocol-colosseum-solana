import type { LucideIcon } from "lucide-react";
import {
  Wallet, TrendingUp, Building2, Target, RefreshCw, Activity,
  ShieldCheck, Brain, Network, Gauge,
  Code2, Terminal, Globe, PlayCircle, Webhook, Cpu,
  BookOpen, List, XCircle, ShieldAlert, Map,
} from "lucide-react";

export type MegaItem = { title: string; description: string; href: string; icon: LucideIcon };
export type MegaColumn = {
  id: "use" | "verify" | "build";
  title: string;
  accent: "electric" | "zk" | "proof";
  icon: LucideIcon;
  items: MegaItem[];
};

export const MEGA_COLUMNS: MegaColumn[] = [
  {
    id: "use",
    title: "Use Atlas",
    accent: "electric",
    icon: Wallet,
    items: [
      { title: "Vaults",        description: "Browse 15 vault strategies, deposit USDC, earn yield.",         href: "/vaults",      icon: Wallet },
      { title: "Markets",       description: "Live DeFiLlama feed of every Solana yield pool.",                href: "/markets",     icon: TrendingUp },
      { title: "Treasury OS",   description: "DAO + business treasury entities. Squads multisig.",             href: "/treasury",    icon: Building2 },
      { title: "Triggers",      description: "Proof-gated stop-loss, take-profit, OCO orders.",                href: "/triggers",    icon: Target },
      { title: "Recurring",     description: "AI-modulated DCA. Adapts to regime, pauses on crisis.",          href: "/recurring",   icon: RefreshCw },
      { title: "Hedging",       description: "Optional treasury IL hedge via Jupiter Perps.",                  href: "/hedging",     icon: Activity },
    ],
  },
  {
    id: "verify",
    title: "Verify Atlas",
    accent: "zk",
    icon: ShieldCheck,
    items: [
      { title: "Proof Explorer",     description: "Every rebalance, the proof, verify in your browser.",       href: "/proofs",            icon: ShieldCheck },
      { title: "Decision Engine",    description: "Why Atlas moved capital — agents, signals, rationale.",     href: "/decision-engine",   icon: Brain },
      { title: "Architecture",       description: "Live blueprint. Hover any node for files + invariants.",    href: "/architecture",      icon: Network },
      { title: "Infra Observatory",  description: "RPC latency, slot drift, proof gen p99 — public.",          href: "/infra",             icon: Gauge },
    ],
  },
  {
    id: "build",
    title: "Build on Atlas",
    accent: "proof",
    icon: Code2,
    items: [
      { title: "TypeScript SDK",     description: "@atlas/sdk on npm. Read state, verify proofs client-side.", href: "/docs/sdk/typescript",        icon: Code2 },
      { title: "Rust SDK",           description: "atlas-rs on crates.io. PDAs, ix builders, Anchor types.",   href: "/docs/sdk/rust",              icon: Terminal },
      { title: "REST + WebSocket",   description: "Public API, no auth, rate-limited. OpenAPI + live spec.",   href: "/docs/api",                   icon: Globe },
      { title: "Playground",         description: "Try every endpoint live. TypeScript, Rust, curl.",          href: "/playground",                 icon: PlayCircle },
      { title: "Webhooks",           description: "HMAC-signed events. Vault rebalances, alerts, signals.",    href: "/docs/webhooks",              icon: Webhook },
      { title: "Verifier CPI",       description: "Any Solana program can call verify_inference. Free.",       href: "/docs/protocol/verifier-cpi", icon: Cpu },
    ],
  },
];

export type MegaFooterLink = { title: string; href: string; icon: LucideIcon };

export const MEGA_FOOTER_LINKS: MegaFooterLink[] = [
  { title: "Why we built this",     href: "/docs/philosophy/why-we-built-this",        icon: BookOpen },
  { title: "The 26 invariants",     href: "/docs/philosophy/the-26-invariants",        icon: List },
  { title: "What we refused",       href: "/docs/philosophy/what-we-refused-to-build", icon: XCircle },
  { title: "Security",              href: "/security",                                 icon: ShieldAlert },
  { title: "Roadmap",               href: "/roadmap",                                  icon: Map },
];

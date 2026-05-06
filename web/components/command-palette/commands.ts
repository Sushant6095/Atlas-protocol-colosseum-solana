// Command palette command catalog (Phase 21 §9, §10).
//
// Two columns of capabilities — navigation and actions. Adding a
// route to §2.x without registering it here is a PR-blocking
// oversight (the lint that enforces this lands in Phase 22 alongside
// the route inventory check).

export interface PaletteCommand {
  id: string;
  /** Visible label. */
  label: string;
  /** What kind of command — drives column placement. */
  kind: "nav" | "action";
  /** Icon name from lucide-react (resolved at render time). */
  icon?: string;
  /** Keyboard hint (e.g. "g v"). */
  shortcut?: string;
  /** Either a route to push or an action to invoke. */
  href?: string;
  invoke?: () => void;
  /** Optional grouping for the palette UI. */
  group?: string;
  /** Required scope check — used by the renderer to hide
   *  inaccessible commands. */
  requires?: "anonymous" | "connected" | "developer" | "any";
  /** Search keywords beyond the label. */
  keywords?: string[];
}

export const NAV_COMMANDS: PaletteCommand[] = [
  // Marketing
  { id: "nav.home",           kind: "nav", group: "marketing", label: "Home",                     href: "/",                  shortcut: "g h" },
  { id: "nav.architecture",   kind: "nav", group: "marketing", label: "Architecture",             href: "/architecture" },
  { id: "nav.security",       kind: "nav", group: "marketing", label: "Security",                 href: "/security" },
  { id: "nav.legal",          kind: "nav", group: "marketing", label: "Legal",                    href: "/legal" },
  // Public
  { id: "nav.infra",          kind: "nav", group: "public",    label: "/infra observatory",       href: "/infra" },
  { id: "nav.proofs",         kind: "nav", group: "public",    label: "Proof Explorer",           href: "/proofs/live" },
  { id: "nav.decision-engine",kind: "nav", group: "public",    label: "AI Decision Observatory",  href: "/decision-engine" },
  // Intelligence
  { id: "nav.intelligence",   kind: "nav", group: "intel",     label: "Intelligence",             href: "/intelligence", shortcut: "g i" },
  { id: "nav.wallet-intel",   kind: "nav", group: "intel",     label: "Wallet intelligence",      href: "/wallet-intelligence" },
  { id: "nav.market",         kind: "nav", group: "intel",     label: "Market",                   href: "/market" },
  { id: "nav.risk",           kind: "nav", group: "intel",     label: "Risk dashboard",           href: "/risk" },
  // Operator
  { id: "nav.vaults",         kind: "nav", group: "operator",  label: "Vaults",                   href: "/vaults",            shortcut: "g v" },
  { id: "nav.rebalance.live", kind: "nav", group: "operator",  label: "Live rebalance",           href: "/rebalance/live",    shortcut: "g r" },
  { id: "nav.triggers",       kind: "nav", group: "operator",  label: "Triggers",                 href: "/triggers" },
  { id: "nav.recurring",      kind: "nav", group: "operator",  label: "Recurring",                href: "/recurring" },
  { id: "nav.hedging",        kind: "nav", group: "operator",  label: "Hedging",                  href: "/hedging" },
  // Treasury
  { id: "nav.treasury",       kind: "nav", group: "treasury",  label: "Treasury",                 href: "/treasury",          shortcut: "g t" },
  // Governance
  { id: "nav.governance",     kind: "nav", group: "governance",label: "Governance",               href: "/governance" },
  { id: "nav.gov.models",     kind: "nav", group: "governance",label: "Model registry",           href: "/governance/models" },
  { id: "nav.gov.agents",     kind: "nav", group: "governance",label: "Scoped keepers",           href: "/governance/agents" },
  // Docs
  { id: "nav.docs",           kind: "nav", group: "docs",      label: "Docs",                     href: "/docs",              shortcut: "g d" },
  { id: "nav.docs.shortcuts", kind: "nav", group: "docs",      label: "Keyboard shortcuts",       href: "/docs/shortcuts" },
  { id: "nav.playground",     kind: "nav", group: "docs",      label: "Playground",               href: "/playground" },
  { id: "nav.webhooks",       kind: "nav", group: "docs",      label: "Webhooks",                 href: "/webhooks", requires: "developer" },
  // Account
  { id: "nav.account",        kind: "nav", group: "account",   label: "Account",                  href: "/account", requires: "connected" },
  { id: "nav.viewing-keys",   kind: "nav", group: "account",   label: "Viewing keys",             href: "/account/viewing-keys", requires: "connected" },
  { id: "nav.preferences",    kind: "nav", group: "account",   label: "Preferences",              href: "/account/preferences", requires: "connected" },
];

/** Action commands are context-aware; the palette renderer composes
 *  this base set with route-derived actions on the fly. */
export const BASE_ACTIONS: PaletteCommand[] = [
  { id: "action.help",          kind: "action", label: "Show keyboard shortcuts",       shortcut: "?", href: "/docs/shortcuts" },
  { id: "action.toggle-rail",   kind: "action", label: "Toggle right rail",             shortcut: "⌘ ." },
  { id: "action.toggle-alerts", kind: "action", label: "Toggle alert center" },
  { id: "action.lock-vault",    kind: "action", label: "Lock viewing-key vault",        requires: "connected" },
];

export const KEYBOARD_SHORTCUT_SHEET: { label: string; shortcut: string }[] = [
  { shortcut: "⌘ K",         label: "Command palette" },
  { shortcut: "g v",         label: "Go to vaults" },
  { shortcut: "g t",         label: "Go to treasuries" },
  { shortcut: "g i",         label: "Go to intelligence" },
  { shortcut: "g d",         label: "Go to docs" },
  { shortcut: "g r",         label: "Go to rebalance live" },
  { shortcut: "⌘ ⇧ V",       label: "Switch active vault" },
  { shortcut: "⌘ ⇧ T",       label: "Switch active treasury" },
  { shortcut: "⌘ /",         label: "Toggle help overlay" },
  { shortcut: "⌘ .",         label: "Toggle right rail" },
  { shortcut: "[ / ]",       label: "Prev / next rebalance" },
  { shortcut: "?",           label: "Show shortcut help" },
];

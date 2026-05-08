// PublicShell.
//
// Used for /infra, /proofs/live, /decision-engine. These pages need
// the same full-chrome header as the marketing surface — Atlas
// wordmark + Product mega-menu + Architecture / Security / Decision
// Engine / Docs nav anchors — so a viewer landing deep can always
// navigate back without a browser back-button.

import type { ShellProps } from "./types";
import { HeaderBar } from "./HeaderBar";

const PUBLIC_NAV = [
  { label: "Architecture",   href: "/architecture" },
  { label: "Security",       href: "/security" },
  { label: "Decision Engine", href: "/decision-engine" },
  { label: "Docs",           href: "/docs" },
];

export function PublicShell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <HeaderBar nav={PUBLIC_NAV} />
      <main className="px-6 py-10 max-w-[1440px] mx-auto">{children}</main>
    </div>
  );
}

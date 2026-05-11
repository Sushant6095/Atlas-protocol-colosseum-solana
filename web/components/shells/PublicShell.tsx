// PublicShell.
//
// Renders the Atlas-wide chrome (APY ticker + 8-pill HeaderNav with
// PRODUCT mega-menu) used across /decision-engine, /infra, /proofs,
// /proofs/live, /vaults, /markets, /dashboard. Same band as the
// marketing surface so judges see one consistent header on every
// route.

import type { ShellProps } from "./types";
import { LiveStrip } from "@/components/marquee/LiveStrip";
import { HeaderNav } from "@/components/nav/HeaderNav";

export function PublicShell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <div className="relative h-14 border-b border-white/5 overflow-hidden z-30">
        <LiveStrip />
      </div>
      <HeaderNav />
      <main className="px-6 py-10 max-w-[1440px] mx-auto">{children}</main>
    </div>
  );
}

// MarketingShell.
//
// PillNav (GSAP-animated) replaces the old HeaderBar on every
// (marketing) route — landing, architecture, security, legal —
// keeping the comprehensive footer untouched.

"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ShellProps } from "./types";
import { Footer } from "@/components/footer/Footer";
import { LiveStrip } from "@/components/marquee/LiveStrip";

// PillNav is a client component (gsap + ResizeObserver). Lazy-load
// with ssr:false so the SSR pass doesn't try to instantiate it.
const PillNav = dynamic(() => import("@/components/effects/PillNav"), {
  ssr: false,
});

// One-click terminal access from the header. Marketing-only routes
// (Architecture / Security / Decision Engine / Docs) stay reachable
// via the comprehensive Footer + the mega-menu.
const PILL_NAV_ITEMS = [
  { label: "Home",           href: "/" },
  { label: "Vaults",         href: "/vaults" },
  { label: "Rebalance",      href: "/rebalance/live" },
  { label: "Triggers",       href: "/triggers" },
  { label: "Recurring",      href: "/recurring" },
  { label: "Hedging",        href: "/hedging" },
  { label: "Treasury",       href: "/treasury" },
  { label: "Governance",     href: "/governance" },
  { label: "Docs",           href: "/docs" },
];

export function MarketingShell({ children }: ShellProps) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      {/* Band 1 — APY ticker. Modal-faithful: relative (scrolls away
          with content), so only the nav stays pinned. */}
      <div className="relative h-10 border-b border-white/5 overflow-hidden z-30">
        <LiveStrip />
      </div>

      {/* Band 2 — PillNav. Sticky below the APY band. PillNav itself
          is `position: sticky; top: 1em` per its own CSS, but we wrap
          in a centered flex so it never collides with siblings. */}
      <PillNav
        logo="/brand/atlas-mark.svg"
        logoAlt="Atlas"
        items={PILL_NAV_ITEMS}
        activeHref={pathname}
        baseColor="#0F1117"
        pillColor="#E6EAF2"
        pillTextColor="#0F1117"
        hoveredPillTextColor="#E6EAF2"
        ease="power3.easeOut"
      />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

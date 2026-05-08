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

// PillNav is a client component (gsap + ResizeObserver). Lazy-load
// with ssr:false so the SSR pass doesn't try to instantiate it.
const PillNav = dynamic(() => import("@/components/effects/PillNav"), {
  ssr: false,
});

const PILL_NAV_ITEMS = [
  { label: "Home",            href: "/" },
  { label: "Architecture",    href: "/architecture" },
  { label: "Security",        href: "/security" },
  { label: "Decision Engine", href: "/decision-engine" },
  { label: "Docs",            href: "/docs" },
];

export function MarketingShell({ children }: ShellProps) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
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

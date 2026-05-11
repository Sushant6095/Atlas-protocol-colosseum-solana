// MarketingShell — APY ticker band + HeaderNav (PRODUCT mega-menu +
// 5 direct pills) + page body + Footer. Wraps every (marketing) route.

"use client";

import type { ShellProps } from "./types";
import { Footer } from "@/components/footer/Footer";
import { LiveStrip } from "@/components/marquee/LiveStrip";
import { HeaderNav } from "@/components/nav/HeaderNav";

export function MarketingShell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      {/* Band 1 — APY ticker. h-14 (56px) matches the Marquee track
          height. */}
      <div className="relative h-14 border-b border-white/5 overflow-hidden z-30">
        <LiveStrip />
      </div>

      {/* Band 2 — HeaderNav. Sticky. */}
      <HeaderNav />

      <main>{children}</main>
      <Footer />
    </div>
  );
}

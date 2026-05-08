// <DemoBanner> — repeating "Demo View: Connect your wallet…" strip.
//
// Sits ABOVE the protocol Marquee on the dashboard. Same scroll
// pattern as the marquee, slower (90s) so it reads as a passive
// hint rather than a competing animation.
//
// Hides when `connected` is true. Tone is execute-green at 8% so
// the banner reads as friendly rather than alarming.

"use client";

import { memo } from "react";
import { clsx } from "clsx";

export interface DemoBannerProps {
  connected: boolean;
  /** Callback for the "Connect your wallet" CTA inside the banner. */
  onConnect?: () => void;
  className?: string;
}

const PHRASE = "Demo View: Connect your wallet to get started";

function DemoBannerImpl({ connected, onConnect, className }: DemoBannerProps): JSX.Element | null {
  if (connected) return null;

  // Repeat the phrase enough times that the strip is visually full
  // before the seamless dual-strip kicks in.
  const phrases = Array.from({ length: 8 }, () => PHRASE).join("  ·  ");

  return (
    <div
      className={clsx("atlas-demo-banner relative w-full overflow-hidden", className)}
      style={{
        background: "color-mix(in oklab, var(--color-accent-execute) 8%, var(--color-surface-base))",
        borderBottom: "1px solid color-mix(in oklab, var(--color-accent-execute) 22%, transparent)",
      }}
      onClick={onConnect}
      role={onConnect ? "button" : undefined}
      tabIndex={onConnect ? 0 : -1}
    >
      <div className="atlas-demo-track flex items-center" style={{ height: 32 }}>
        <span
          aria-hidden={false}
          className="font-mono text-xs uppercase tracking-[0.18em] whitespace-nowrap px-6 shrink-0"
          style={{ color: "var(--color-accent-execute)" }}
        >
          {phrases}
        </span>
        <span
          aria-hidden
          className="font-mono text-xs uppercase tracking-[0.18em] whitespace-nowrap px-6 shrink-0"
          style={{ color: "var(--color-accent-execute)" }}
        >
          {phrases}
        </span>
      </div>
      <style>{`
        .atlas-demo-banner .atlas-demo-track {
          width: max-content;
          animation: atlas-demo-scroll 90s linear infinite;
        }
        .atlas-demo-banner:hover .atlas-demo-track {
          animation-play-state: paused;
        }
        @keyframes atlas-demo-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .atlas-demo-banner .atlas-demo-track { animation: none; }
        }
      `}</style>
    </div>
  );
}

export const DemoBanner = memo(DemoBannerImpl);
DemoBanner.displayName = "DemoBanner";

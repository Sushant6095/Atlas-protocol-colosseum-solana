// <Marquee /> — the living strip.
//
// Atlas's at-the-top-of-page yield ticker. One Atlas-branded item
// (zk-verified treasury) leads the row; everything to the right is
// a real Solana yield venue with logo + APY% + status dot.
//
// Implementation discipline:
//   - dual-strip CSS animation (no JS RAF, no third-party marquee)
//   - hover anywhere in the row → animation pauses via the group-
//     hover class chain on the inner track
//   - status dot pulses via CSS keyframe; respects reduced-motion
//   - on `prefers-reduced-motion: reduce` the row stops scrolling
//     entirely and renders as a single static strip
//
// The marquee owns no data — `items` is passed in from the host so
// it can be SSR'd from the DeFiLlama integration or hydrated from
// a TanStack Query cache.

"use client";

import { memo, useEffect, useState } from "react";
import { clsx } from "clsx";

export type MarqueeStatus = "live" | "paused" | "depegged";

export interface MarqueeItem {
  /** Unique key. */
  id: string;
  /** Display name (lowercase rendered). */
  name: string;
  /** Inline icon or url. If a string starts with "/" or "http" we
   *  render it as <img>; otherwise it's a glyph string (rare). */
  logo: string;
  /** APY in basis points (e.g. 1284 = 12.84%). */
  apyBps?: number;
  /** Optional pre-formatted display label (overrides apyBps). */
  display?: string;
  status: MarqueeStatus;
  /** Brand colour for the disc behind the logo. */
  brand?: string;
  /** Optional click-target. */
  href?: string;
  /** Atlas-branded leading item gets `kind: "atlas"` and a different
   *  treatment (zk border + zk pulse, no APY%). */
  kind?: "atlas" | "venue";
}

export interface MarqueeProps {
  items: MarqueeItem[];
  /** Loop duration. Default 60s desktop. The component drops to 40s
   *  on viewports < 768px so the strip stays kinetic on mobile. */
  durationS?: number;
  className?: string;
}

const STATUS_COLOR: Record<MarqueeStatus, string> = {
  live:     "var(--color-accent-execute)",
  paused:   "var(--color-accent-warn)",
  depegged: "var(--color-accent-danger)",
};

function MarqueeImpl({ items, durationS = 60, className }: MarqueeProps): JSX.Element {
  // Mobile speed-up: 40s under 768px. We render an inline style with
  // a media query baked in via two CSS variables so React doesn't
  // need to listen to resize.
  const styleVars = {
    "--marquee-duration": `${durationS}s`,
    "--marquee-duration-mobile": `${Math.round(durationS * 0.66)}s`,
  } as React.CSSProperties;

  return (
    <div
      role="region"
      aria-label="Live yield venues"
      className={clsx(
        "atlas-marquee group relative w-full overflow-hidden",
        "border-b border-[color:var(--color-line-soft)]",
        "bg-[color:var(--color-surface-base)]",
        className,
      )}
      style={styleVars}
    >
      {/* Edge fades — the strip dissolves into the surface at both
          edges so an item never appears to be cut off mid-glyph. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10"
        style={{ background: "linear-gradient(to right, var(--color-surface-base), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10"
        style={{ background: "linear-gradient(to left, var(--color-surface-base), transparent)" }}
      />

      {/* The dual-strip track. Both copies are aria-hidden duplicates
          — only the first carries the items semantically. */}
      <div className="atlas-marquee-track flex items-center" style={{ height: 56 }}>
        <Strip items={items} primary />
        <Strip items={items} primary={false} />
      </div>

      {/* Inline keyframes + reduced-motion fallback. Scoped via the
          `.atlas-marquee` parent so the rule doesn't pollute. */}
      <style>{`
        .atlas-marquee-track {
          width: max-content;
          animation: atlas-marquee-scroll var(--marquee-duration) linear infinite;
        }
        @media (max-width: 767px) {
          .atlas-marquee-track {
            animation-duration: var(--marquee-duration-mobile);
          }
        }
        .atlas-marquee:hover .atlas-marquee-track {
          animation-play-state: paused;
        }
        @keyframes atlas-marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .atlas-marquee-track { animation: none; }
        }
        @keyframes atlas-marquee-pulse {
          0%   { opacity: 1.0; transform: scale(1); }
          50%  { opacity: 0.55; transform: scale(1.4); }
          100% { opacity: 1.0; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function Strip({ items, primary }: { items: MarqueeItem[]; primary: boolean }): JSX.Element {
  return (
    <ul
      aria-hidden={!primary}
      className="flex items-center gap-8 px-8 shrink-0"
      style={{ minWidth: "50%" }}
    >
      {items.map((it) => (
        <li key={`${primary ? "a" : "b"}-${it.id}`} className="flex-none">
          <Item item={it} />
        </li>
      ))}
    </ul>
  );
}

function Item({ item }: { item: MarqueeItem }): JSX.Element {
  const isAtlas = item.kind === "atlas";
  const dot = isAtlas ? "var(--color-accent-zk)" : STATUS_COLOR[item.status];
  const display = item.display ?? (item.apyBps != null ? `${(item.apyBps / 100).toFixed(2)}%` : "—");

  const inner = (
    <span
      className={clsx(
        "inline-flex items-center gap-3 h-10 px-3 rounded-full",
        "transition-[border-color,box-shadow] duration-[var(--duration-quick)]",
        isAtlas && "border",
      )}
      style={{
        borderColor: isAtlas ? "color-mix(in oklab, var(--color-accent-zk) 35%, transparent)" : undefined,
        background:  isAtlas ? "color-mix(in oklab, var(--color-accent-zk) 8%, var(--color-surface-base))" : "transparent",
      }}
    >
      <Logo item={item} />
      <span className="flex flex-col leading-none">
        <span className="font-mono text-sm font-semibold text-[color:var(--color-ink-primary)] tabular-nums">
          {isAtlas ? "zk-verified ✓" : display}
        </span>
        <span className="font-body text-[11px] lowercase text-[color:var(--color-ink-tertiary)] mt-1">
          {item.name}
        </span>
      </span>
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: dot,
          animation: "atlas-marquee-pulse 1.5s ease-in-out infinite",
        }}
      />
    </span>
  );

  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)] rounded-full">
        {inner}
      </a>
    );
  }
  return inner;
}

function Logo({ item }: { item: MarqueeItem }): JSX.Element {
  const isUrl = item.logo.startsWith("/") || item.logo.startsWith("http");
  const brand = item.brand ?? "var(--color-accent-electric)";

  return (
    <span
      className="grid place-items-center h-7 w-7 rounded-full flex-none overflow-hidden"
      style={{
        background: `color-mix(in oklab, ${brand} 14%, var(--color-surface-raised))`,
        boxShadow:  `inset 0 0 0 1px color-mix(in oklab, ${brand} 35%, transparent)`,
      }}
      aria-hidden
    >
      {isUrl
        ? <img src={item.logo} alt="" width={20} height={20} className="object-contain" />
        : <span className="font-mono text-[11px] font-semibold uppercase" style={{ color: brand }}>{item.logo}</span>}
    </span>
  );
}

export const Marquee = memo(MarqueeImpl);
Marquee.displayName = "Marquee";

// ─── Optional: data adapter for the DeFiLlama markets module ────
//
// Keeping this in the same file because the marquee + its data
// shape ship together. Hosts that already have their own data
// pipeline can ignore this and pass `MarqueeItem[]` directly.

export interface DefiLlamaPool {
  pool?: string;
  symbol?: string;
  project?: string;
  apy?: number | null;
  apyMean30d?: number | null;
  tvlUsd?: number;
}

const PROTOCOL_BRAND: Record<string, string> = {
  kamino:   "#3CE39A",
  drift:    "#76E4F7",
  marginfi: "#C0FF4A",
  jupiter:  "#C7F284",
  orca:     "#FFA1A8",
  raydium:  "#A682FF",
  solend:   "#F478C6",
  meteora:  "#3F8CFF",
  jito:     "#3CE39A",
  default:  "#7DB7FF",
};

const PROTOCOL_LOGO: Record<string, string> = {
  kamino:   "/brand/protocols/kamino.png",
  drift:    "/brand/protocols/drift.png",
  marginfi: "/brand/protocols/marginfi.png",
  jupiter:  "/brand/protocols/jupiter.svg",
  jito:     "/brand/protocols/jito.png",
  orca:     "/brand/protocols/orca.png",
  raydium:  "/brand/protocols/raydium.png",
};

export function adaptDefiLlama(pools: DefiLlamaPool[], opts?: {
  /** Max venues after the Atlas leader. Default 12. */
  topN?: number;
  /** Atlas-branded leader item. Default included. */
  withAtlasLeader?: boolean;
}): MarqueeItem[] {
  const topN = opts?.topN ?? 12;
  const withAtlasLeader = opts?.withAtlasLeader ?? true;

  const venues: MarqueeItem[] = pools
    .filter((p) => (p.tvlUsd ?? 0) > 0 && (p.apy ?? 0) > 0)
    .slice(0, topN)
    .map((p) => {
      const proj = (p.project ?? "venue").toLowerCase();
      const brand = PROTOCOL_BRAND[proj] ?? PROTOCOL_BRAND.default;
      const logo = PROTOCOL_LOGO[proj] ?? proj.slice(0, 2);
      return {
        id: p.pool ?? `${proj}-${p.symbol ?? "?"}`,
        name: `${proj} · ${(p.symbol ?? "").toLowerCase()}`,
        logo,
        apyBps: Math.round((p.apy ?? 0) * 100),
        status: "live" as MarqueeStatus,
        brand,
      };
    });

  if (!withAtlasLeader) return venues;

  const leader: MarqueeItem = {
    id: "atlas",
    name: "atlas treasury",
    logo: "/brand/atlas-mark.png",
    status: "live",
    brand: "var(--color-accent-zk)",
    kind: "atlas",
  };

  return [leader, ...venues];
}

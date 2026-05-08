// ProtocolIcon — single source of truth for every protocol /
// counterparty / data-source mark Atlas surfaces.
//
// Resolution order:
//   1. Real PNG/SVG asset under `/public/brand/protocols/{slug}.png`
//   2. Hand-tuned inline SVG fallback (slug → glyph + branded fill)
//   3. Generic monogram disc (1-2 letters from the slug)
//
// Atlas integrates into other people's brands constantly (yields,
// settlements, oracles, multisigs). This component keeps that
// surface coherent — every row, every diagram, every block-list
// reaches for the same mark by slug.

"use client";

import Image from "next/image";
import { memo } from "react";
import { cn } from "./cn";

export type ProtocolSlug =
  | "solana" | "kamino" | "drift" | "marginfi" | "jupiter"
  | "pyth"   | "jito"   | "squads" | "succinct" | "sp1"
  | "atlas";

export type ProtocolIconSize = 16 | 20 | 24 | 28 | 32 | 40 | 56 | 80;

export interface ProtocolIconProps {
  slug: ProtocolSlug;
  size?: ProtocolIconSize;
  /** Visual treatment around the mark. */
  surface?: "bare" | "disc" | "tile";
  /** Subtle ring on hover. Off by default. */
  glow?: boolean;
  /** Override the rendered name (a11y label only). */
  label?: string;
  className?: string;
}

interface Entry {
  /** PNG/SVG file name under `/public/brand/protocols/`. Null = inline-only. */
  asset: string | null;
  /** Brand colour for the disc / glow / monogram. */
  brand: string;
  /** Display label. */
  label: string;
  /** Hand-tuned inline SVG used when no asset is present. */
  inline?: (size: number) => JSX.Element;
}

const REGISTRY: Record<ProtocolSlug, Entry> = {
  atlas: {
    asset: "/brand/atlas-mark.png",
    brand: "#3F8CFF",
    label: "Atlas",
  },
  solana: {
    asset: "/brand/protocols/solana.svg",
    brand: "#9945FF",
    label: "Solana",
  },
  kamino: {
    asset: "/brand/protocols/kamino.png",
    brand: "#3CE39A",
    label: "Kamino Finance",
  },
  drift: {
    asset: null,
    brand: "#76E4F7",
    label: "Drift",
    inline: (s) => (
      <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
        <path d="M16 4c6 0 10 4 10 10 0 8-10 14-10 14S6 22 6 14C6 8 10 4 16 4z"
              fill="#0B0D12" stroke="#76E4F7" strokeWidth="1.6" />
        <circle cx="16" cy="13" r="3.5" fill="#76E4F7" />
      </svg>
    ),
  },
  marginfi: {
    asset: "/brand/protocols/marginfi.png",
    brand: "#C0FF4A",
    label: "Marginfi",
  },
  jupiter: {
    asset: "/brand/protocols/jupiter.svg",
    brand: "#C7F284",
    label: "Jupiter",
  },
  pyth: {
    asset: "/brand/protocols/pyth.png",
    brand: "#A682FF",
    label: "Pyth Network",
  },
  jito: {
    asset: "/brand/protocols/jito.png",
    brand: "#3CE39A",
    label: "Jito",
  },
  squads: {
    asset: null,
    brand: "#7DB7FF",
    label: "Squads",
    inline: (s) => (
      <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
        <rect x="6"  y="6"  width="9" height="9" rx="1.5" fill="#7DB7FF" />
        <rect x="17" y="6"  width="9" height="9" rx="1.5" fill="#A682FF" opacity="0.85" />
        <rect x="6"  y="17" width="9" height="9" rx="1.5" fill="#A682FF" opacity="0.85" />
        <rect x="17" y="17" width="9" height="9" rx="1.5" fill="#3F8CFF" />
      </svg>
    ),
  },
  succinct: {
    asset: null,
    brand: "#FF8761",
    label: "Succinct (SP1)",
    inline: (s) => (
      <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
        <circle cx="16" cy="16" r="13" fill="#FF8761" opacity="0.18" />
        <path d="M9 14h14M9 18h10" stroke="#FF8761" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="22" cy="18" r="2" fill="#FF8761" />
      </svg>
    ),
  },
  sp1: {
    asset: null,
    brand: "#FF8761",
    label: "SP1 zkVM",
    inline: (s) => (
      <svg viewBox="0 0 32 32" width={s} height={s} aria-hidden>
        <rect x="3" y="3" width="26" height="26" rx="6" fill="none"
              stroke="#FF8761" strokeWidth="1.6" />
        <text x="16" y="22" textAnchor="middle"
              fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700"
              fill="#FF8761">SP1</text>
      </svg>
    ),
  },
};

const SURFACE_PADDING: Record<NonNullable<ProtocolIconProps["surface"]>, string> = {
  bare: "p-0",
  disc: "p-[14%] rounded-full",
  tile: "p-[14%] rounded-[var(--radius-sm)]",
};

function ProtocolIconImpl({
  slug, size = 24, surface = "bare", glow = false, label, className,
}: ProtocolIconProps): JSX.Element {
  const entry = REGISTRY[slug];
  const a11y = label ?? entry.label;

  const innerSize = surface === "bare" ? size : Math.round(size * 0.72);

  return (
    <span
      role="img"
      aria-label={a11y}
      className={cn(
        "relative inline-flex items-center justify-center flex-none overflow-hidden",
        SURFACE_PADDING[surface],
        glow && "transition-[filter] duration-[var(--duration-quick)] ease-[var(--ease-glide)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: surface === "bare" ? "transparent" : "color-mix(in oklab, " + entry.brand + " 14%, var(--color-surface-raised))",
        boxShadow: surface === "bare"
          ? undefined
          : `inset 0 0 0 1px color-mix(in oklab, ${entry.brand} 35%, transparent)`,
        filter: glow ? `drop-shadow(0 0 6px color-mix(in oklab, ${entry.brand} 50%, transparent))` : undefined,
      }}
    >
      {entry.asset ? (
        <Image
          src={entry.asset}
          alt=""
          width={innerSize}
          height={innerSize}
          className="object-contain"
          unoptimized={entry.asset.endsWith(".svg") || entry.asset.endsWith(".png")}
        />
      ) : entry.inline ? (
        entry.inline(innerSize)
      ) : (
        <Monogram label={entry.label} brand={entry.brand} size={innerSize} />
      )}
    </span>
  );
}

function Monogram({ label, brand, size }: { label: string; brand: string; size: number }): JSX.Element {
  const initials = label.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect x="0" y="0" width="32" height="32" rx="6" fill={brand} opacity="0.18" />
      <text x="16" y="22" textAnchor="middle"
            fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="700" fill={brand}>
        {initials}
      </text>
    </svg>
  );
}

export const ProtocolIcon = memo(ProtocolIconImpl);
ProtocolIcon.displayName = "ProtocolIcon";

export const PROTOCOL_LABELS: Record<ProtocolSlug, string> = Object.fromEntries(
  (Object.keys(REGISTRY) as ProtocolSlug[]).map((k) => [k, REGISTRY[k].label]),
) as Record<ProtocolSlug, string>;

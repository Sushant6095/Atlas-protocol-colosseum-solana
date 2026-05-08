// AtlasMark — single source of truth for the Atlas logo glyph.
//
// Anywhere in the app that needs the brand mark reaches for this
// component. The asset lives at `/public/brand/atlas-mark.png` so
// any host domain (localhost, atlasfi.in, vercel preview, …)
// serves the same identity from the same path.
//
// Variants:
//   - "glyph"     just the mark (square)
//   - "wordmark"  mark + lowercase "atlas" beside it
//
// Sizing presets keep typography paired correctly with the mark
// across the navbar, modals, and the marketing footer.

"use client";

import Image from "next/image";
import { memo } from "react";
import { cn } from "./cn";

export type AtlasMarkVariant = "glyph" | "wordmark";
export type AtlasMarkSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AtlasMarkProps {
  variant?: AtlasMarkVariant;
  size?: AtlasMarkSize;
  /** Subtle drop-glow on hover. Off by default. */
  glow?: boolean;
  className?: string;
  /** Optional label override; default "atlas". Lowercase enforced. */
  label?: string;
}

const PX: Record<AtlasMarkSize, { glyph: number; text: number; tracking: string }> = {
  xs: { glyph: 16, text: 12, tracking: "-0.01em" },
  sm: { glyph: 20, text: 14, tracking: "-0.01em" },
  md: { glyph: 24, text: 16, tracking: "-0.015em" },
  lg: { glyph: 32, text: 20, tracking: "-0.02em" },
  xl: { glyph: 48, text: 28, tracking: "-0.02em" },
};

function AtlasMarkImpl({
  variant = "wordmark",
  size = "sm",
  glow = false,
  className,
  label = "atlas",
}: AtlasMarkProps): JSX.Element {
  const dim = PX[size];

  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="Atlas">
      <span
        className={cn(
          "relative inline-flex flex-none items-center justify-center",
          glow && "transition-[filter] duration-[var(--duration-quick)] ease-[var(--ease-glide)] hover:[filter:drop-shadow(0_0_12px_rgba(63,140,255,0.45))]",
        )}
        style={{ width: dim.glyph, height: dim.glyph }}
      >
        <Image
          src="/brand/atlas-mark.png"
          alt=""
          width={dim.glyph}
          height={dim.glyph}
          priority={size === "lg" || size === "xl"}
          className="h-full w-full object-contain"
        />
      </span>
      {variant === "wordmark" && (
        <span
          className="font-display font-medium lowercase select-none"
          style={{
            fontSize: dim.text,
            lineHeight: `${Math.round(dim.text * 1.0)}px`,
            letterSpacing: dim.tracking,
            color: "var(--color-ink-primary)",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

export const AtlasMark = memo(AtlasMarkImpl);
AtlasMark.displayName = "AtlasMark";

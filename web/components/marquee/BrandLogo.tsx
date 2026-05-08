"use client";

import { useState } from "react";

type Props = {
  slug: string;
  domain: string | null;
  name: string;
  color: string;
  size?: number;
  className?: string;
};

// Try local extensions in order of crispness. First file that loads wins.
const EXTENSIONS = ["svg", "png", "webp", "jpg"] as const;

/**
 * Resolution order:
 *   1. /brand/protocols/{slug}.{svg|png|webp|jpg}  (vendored — first hit wins)
 *   2. text-mark fallback in brand color
 *
 * domain is reserved for future Brandfetch / Logo.dev integration with API key.
 */
export function BrandLogo({ slug, name, color, size = 36, className }: Props) {
  const [extIdx, setExtIdx] = useState(0);
  const [textFallback, setTextFallback] = useState(false);

  const wrapperClass =
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg " +
    (className ?? "");
  const dim = { width: size, height: size };

  if (!textFallback && extIdx < EXTENSIONS.length) {
    const src = `/brand/protocols/${slug}.${EXTENSIONS[extIdx]}`;
    return (
      <span className={wrapperClass} style={dim}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => {
            const next = extIdx + 1;
            if (next >= EXTENSIONS.length) setTextFallback(true);
            else setExtIdx(next);
          }}
        />
      </span>
    );
  }

  // text-mark fallback — initials in brand color
  const initials = name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      className={wrapperClass}
      style={{
        ...dim,
        backgroundColor: `${color}1f`,
        boxShadow: `inset 0 0 0 1px ${color}55`,
      }}
    >
      <span
        className="font-display text-[10px] font-bold tracking-[0.04em]"
        style={{ color }}
      >
        {initials}
      </span>
    </span>
  );
}

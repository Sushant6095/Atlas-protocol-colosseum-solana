// <MonoNumber> — formatted numeric with optional subscript decimals.
//
// The "subscript decimals" trick is Lulo's signature: the integer
// part renders at the headline size, the decimal portion renders
// smaller in ink.tertiary. Reads as "$100,805.92" with .92 dimmed.
//
// Use `subscript={true}` whenever a USD figure has a `.NN` portion.
// For integer counts (rebalance count, proof count, slot numbers)
// keep `subscript={false}`.

"use client";

import { memo } from "react";
import { clsx } from "clsx";

export interface MonoNumberProps {
  value: number | string;
  /** Currency / unit prefix (e.g. "$"). */
  prefix?: string;
  /** Unit suffix (e.g. "%", " SOL"). */
  suffix?: string;
  /** Decimal places when value is numeric. */
  precision?: number;
  /** Render decimal portion in smaller dimmed type (Lulo signature). */
  subscript?: boolean;
  /** Locale-aware grouping. Default true. */
  group?: boolean;
  /** Display size — drives the integer portion. */
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  className?: string;
}

const SIZE_PX: Record<NonNullable<MonoNumberProps["size"]>, [number, number]> = {
  sm:   [16, 22],
  md:   [22, 28],
  lg:   [32, 36],
  xl:   [44, 48],
  hero: [56, 60],
};

function MonoNumberImpl({
  value, prefix, suffix, precision, subscript = false, group = true,
  size = "md", className,
}: MonoNumberProps): JSX.Element {
  const [size_int, lh_int] = SIZE_PX[size];
  const size_dec = Math.round(size_int * 0.55);

  let intPart = "";
  let decPart = "";

  if (typeof value === "number" && Number.isFinite(value)) {
    const fixed = value.toFixed(precision ?? 2);
    const [i, d] = fixed.split(".");
    intPart = group ? Number(i).toLocaleString() : i;
    decPart = d ?? "";
  } else {
    const s = String(value);
    const dotAt = s.indexOf(".");
    if (dotAt >= 0 && subscript) {
      intPart = s.slice(0, dotAt);
      decPart = s.slice(dotAt + 1);
    } else {
      intPart = s;
    }
  }

  return (
    <span
      className={clsx("font-mono inline-flex items-baseline tabular-nums", className)}
      style={{ color: "var(--color-ink-primary)" }}
    >
      {prefix && (
        <span style={{ fontSize: size_dec, color: "var(--color-ink-tertiary)" }}>
          {prefix}
        </span>
      )}
      <span style={{ fontSize: size_int, lineHeight: `${lh_int}px`, fontWeight: 600 }}>
        {intPart}
      </span>
      {decPart && subscript && (
        <span style={{ fontSize: size_dec, color: "var(--color-ink-tertiary)", marginLeft: 1 }}>
          .{decPart}
        </span>
      )}
      {decPart && !subscript && (
        <span style={{ fontSize: size_int, fontWeight: 600 }}>.{decPart}</span>
      )}
      {suffix && (
        <span style={{ fontSize: size_dec, color: "var(--color-ink-tertiary)", marginLeft: 4 }}>
          {suffix}
        </span>
      )}
    </span>
  );
}

export const MonoNumber = memo(MonoNumberImpl);
MonoNumber.displayName = "MonoNumber";

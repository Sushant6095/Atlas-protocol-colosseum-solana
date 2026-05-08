// MonoNumber — large monospace numerals with deliberate digit
// alignment. Use anywhere a number's exact value matters more than
// its narrative meaning (KPIs, basis points, slot ids, balances).
//
// Hard rules baked in:
//   - tabular-nums so digits never reflow row width
//   - locale-aware grouping via Intl.NumberFormat
//   - K/M/B abbreviation toggle, never lossy without it on
//   - sign + unit slots that don't disturb digit alignment
//   - opacity 0.6 zero state when value === null (skeleton-safe)
//
// Numbers do NOT animate. Springs are for users, not data.

"use client";

import { memo } from "react";
import { cn } from "./cn";

export interface MonoNumberProps {
  value: number | null | undefined;
  /** Decimal places when value is concrete. Default 0. */
  precision?: number;
  /** Reserve N digit-widths so updates never reflow the row. */
  reserveWidth?: number;
  /** Locale-aware grouping. Off for hashes / slot ids; on by default. */
  group?: boolean;
  /** Trailing unit (e.g. "ms", "SOL", "bps"). Rendered smaller. */
  unit?: string;
  /** Always render a sign prefix (`+`/`-`). Default false. */
  signed?: boolean;
  /** Compact (1.2K, 3.4M, 240B). Default false. */
  abbreviate?: boolean;
  /** Visual size. */
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  /** Tone — drives ink color. */
  tone?: "default" | "muted" | "execute" | "warn" | "danger" | "accent";
  className?: string;
}

const SIZE_CLASS: Record<Required<MonoNumberProps>["size"], string> = {
  sm:   "text-[13px] leading-[18px]",
  md:   "text-[16px] leading-[22px]",
  lg:   "text-[20px] leading-[28px]",
  xl:   "text-[28px] leading-[36px]",
  hero: "text-[40px] leading-[48px]",
};

const TONE_CLASS: Record<Required<MonoNumberProps>["tone"], string> = {
  default: "text-[color:var(--color-ink-primary)]",
  muted:   "text-[color:var(--color-ink-secondary)]",
  execute: "text-[color:var(--color-accent-execute)]",
  warn:    "text-[color:var(--color-accent-warn)]",
  danger:  "text-[color:var(--color-accent-danger)]",
  accent:  "text-[color:var(--color-accent-electric)]",
};

function MonoNumberImpl({
  value, precision = 0, reserveWidth, group = true,
  unit, signed = false, abbreviate = false,
  size = "md", tone = "default", className,
}: MonoNumberProps): JSX.Element {
  const text = value == null ? "—" : format(value, { precision, group, signed, abbreviate });

  return (
    <span
      className={cn(
        "font-mono inline-flex items-baseline gap-1",
        "tabular-nums tracking-tight",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        value == null && "opacity-60",
        className,
      )}
      style={reserveWidth != null
        ? { minWidth: `${reserveWidth}ch`, justifyContent: "flex-end" }
        : undefined}
    >
      <span>{text}</span>
      {unit && (
        <span className="text-[color:var(--color-ink-tertiary)] font-mono text-[0.62em] uppercase tracking-[0.06em]">
          {unit}
        </span>
      )}
    </span>
  );
}

interface FormatOpts { precision: number; group: boolean; signed: boolean; abbreviate: boolean }

function format(n: number, o: FormatOpts): string {
  if (!Number.isFinite(n)) return "—";

  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : o.signed ? "+" : "";

  if (o.abbreviate) {
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(o.precision || 1)}B`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(o.precision || 1)}M`;
    if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(o.precision || 1)}K`;
  }

  return `${sign}${abs.toLocaleString(undefined, {
    minimumFractionDigits: o.precision,
    maximumFractionDigits: o.precision,
    useGrouping: o.group,
  })}`;
}

export const MonoNumber = memo(MonoNumberImpl);
MonoNumber.displayName = "MonoNumber";

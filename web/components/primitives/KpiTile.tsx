// KpiTile — compact metric cell. Mono numeral, label below in
// ink-tertiary text-xs uppercase tracking, optional delta pill in
// execute / danger / warn. Border + subtle accent glow on hover.
//
// Used in dashboards (Vault Terminal, /infra observatory, treasury
// runway), and on the landing hero alongside the Pleiades scene.
//
// Anti-pattern guard rails:
//   - the value never animates (numbers tween linearly via parent
//     state mutation, springs are forbidden for data)
//   - one accent per tile; `tone` drives both the value colour and
//     the hover glow; combining tones is rejected at compile time
//   - layout-stable: skeleton state has the same height as the
//     populated state.

"use client";

import { memo, type ReactNode } from "react";
import { cn } from "./cn";
import { MonoNumber, type MonoNumberProps } from "./MonoNumber";

type Tone = "neutral" | "execute" | "warn" | "danger" | "accent";

export interface KpiTileProps {
  label: string;
  /** Either a `MonoNumber`-shaped value, or any ReactNode. */
  value: number | null | undefined | ReactNode;
  /** Unit suffix (rendered next to the number, never inline). */
  unit?: string;
  /** Decimal places for numeric values. */
  precision?: MonoNumberProps["precision"];
  /** Compact (1.2K, 3.4M…). Default false. */
  abbreviate?: MonoNumberProps["abbreviate"];
  /** Display size for the value. */
  size?: MonoNumberProps["size"];
  /** Mono digit-width reservation. */
  reserveWidth?: MonoNumberProps["reserveWidth"];
  /** Optional signed delta pill (e.g. +12.4 / -3.2). */
  delta?: number;
  /** Delta unit. Default "%". */
  deltaUnit?: string;
  /** Inverts delta colouring (negative = good — used for latency). */
  invertDelta?: boolean;
  /** Footer line beneath the value. */
  hint?: ReactNode;
  /** Drives accent rule + hover glow. */
  tone?: Tone;
  /** Skeleton mode — keeps layout, suppresses content. */
  loading?: boolean;
  className?: string;
}

const RULE: Record<Tone, string> = {
  neutral: "var(--color-line-medium)",
  execute: "var(--color-accent-execute)",
  warn:    "var(--color-accent-warn)",
  danger:  "var(--color-accent-danger)",
  accent:  "var(--color-accent-electric)",
};

const GLOW: Record<Tone, string> = {
  neutral: "var(--shadow-glow-electric)",
  execute: "var(--shadow-glow-execute)",
  warn:    "var(--shadow-glow-electric)",
  danger:  "0 0 24px rgba(255,97,102,0.30)",
  accent:  "var(--shadow-glow-electric)",
};

function KpiTileImpl({
  label, value, unit, precision = 0, abbreviate, size = "lg", reserveWidth,
  delta, deltaUnit = "%", invertDelta = false,
  hint, tone = "neutral", loading = false, className,
}: KpiTileProps): JSX.Element {
  const isNumber = typeof value === "number" || value == null;
  const monoTone: MonoNumberProps["tone"] =
    tone === "neutral" ? "default"
    : tone === "execute" ? "execute"
    : tone === "warn" ? "warn"
    : tone === "danger" ? "danger"
    : "accent";

  return (
    <div
      data-tone={tone}
      className={cn(
        "group relative flex flex-col gap-2",
        "rounded-[var(--radius-sm)]",
        "px-4 py-3",
        "bg-[color:var(--color-surface-raised)]",
        "border border-[color:var(--color-line-soft)]",
        "transition-[box-shadow,border-color] duration-[var(--duration-quick)] ease-[var(--ease-glide)]",
        "hover:border-[color:var(--color-line-medium)]",
        className,
      )}
      style={{
        // Left rule indicates tone; subtle on rest, brighter on hover.
        boxShadow: `inset 2px 0 0 ${RULE[tone]}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = `inset 2px 0 0 ${RULE[tone]}, ${GLOW[tone]}`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = `inset 2px 0 0 ${RULE[tone]}`; }}
    >
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
        {label}
      </span>

      {loading ? (
        <SkeletonLine size={size} />
      ) : isNumber ? (
        <MonoNumber
          value={value as number | null | undefined}
          precision={precision}
          abbreviate={abbreviate}
          reserveWidth={reserveWidth}
          unit={unit}
          size={size}
          tone={monoTone}
        />
      ) : (
        <span className="font-display text-[20px] leading-[28px] text-[color:var(--color-ink-primary)]">
          {value as ReactNode}
        </span>
      )}

      {(hint || delta != null) && (
        <div className="flex items-center gap-2 text-[11px]">
          {delta != null && <DeltaPill delta={delta} unit={deltaUnit} invert={invertDelta} />}
          {hint && (
            <span className="text-[color:var(--color-ink-tertiary)]">{hint}</span>
          )}
        </div>
      )}
    </div>
  );
}

function DeltaPill({ delta, unit, invert }: { delta: number; unit: string; invert: boolean }): JSX.Element {
  const positive = delta > 0;
  const zero = delta === 0;
  const good = invert ? !positive : positive;
  const colour = zero ? "var(--color-ink-tertiary)"
              : good  ? "var(--color-accent-execute)"
              :         "var(--color-accent-danger)";
  const arrow = zero ? "·" : positive ? "▲" : "▼";
  const sign = positive ? "+" : "";
  return (
    <span className="inline-flex items-center gap-1 font-mono tabular-nums" style={{ color: colour }}>
      <span aria-hidden>{arrow}</span>
      <span>{sign}{delta.toFixed(2)}{unit}</span>
    </span>
  );
}

function SkeletonLine({ size }: { size: NonNullable<MonoNumberProps["size"]> }): JSX.Element {
  const h = size === "hero" ? 48 : size === "xl" ? 36 : size === "lg" ? 28 : size === "md" ? 22 : 18;
  return (
    <span
      aria-hidden
      className="block rounded-[2px] bg-[color:var(--color-line-soft)] animate-pulse"
      style={{ height: h, width: "60%" }}
    />
  );
}

export const KpiTile = memo(KpiTileImpl);
KpiTile.displayName = "KpiTile";

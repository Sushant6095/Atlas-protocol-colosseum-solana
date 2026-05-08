// Tile primitives — Phase 24 §1.2.
//
// Tiny mono-typed metric tiles. Operator surfaces compose dense
// dashboards from these. KpiTile = label + value + optional foot.
// DeltaTile = signed-delta with directional colour. MonoNumber =
// raw number renderer that reserves digit-width so updates don't
// reflow.

import { createElement, memo, type ReactNode } from "react";
import { vizColor, vizFont } from "./tokens.js";

// ─────────────────────────────────────────────────────────────────
// MonoNumber
// ─────────────────────────────────────────────────────────────────

export interface MonoNumberProps {
  value: number | string;
  /** Reserve N character widths — prevents reflow on updates. */
  width?: number;
  /** Decimal places (numeric values only). */
  precision?: number;
  /** Locale-aware grouping. Off for hashes / slot ids. */
  group?: boolean;
  className?: string;
}

function MonoNumberImpl({
  value, width, precision, group = true, className,
}: MonoNumberProps): ReactNode {
  const text = typeof value === "number"
    ? formatNumber(value, precision, group)
    : value;

  return createElement("span", {
    className,
    style: {
      font: `13px ${vizFont.mono}`,
      color: vizColor.ink,
      fontVariantNumeric: "tabular-nums",
      display: "inline-block",
      minWidth: width != null ? `${width}ch` : undefined,
      textAlign: width != null ? "right" : undefined,
    },
  }, text);
}

export const MonoNumber = memo(MonoNumberImpl);
(MonoNumber as { displayName?: string }).displayName = "MonoNumber";

// ─────────────────────────────────────────────────────────────────
// KpiTile
// ─────────────────────────────────────────────────────────────────

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  /** Trailing unit (e.g. "ms", "SOL"). */
  unit?: string;
  /** Foot-line — supplementary context, smaller font. */
  foot?: ReactNode;
  /** Tone hint — drives left-rule colour. */
  tone?: "neutral" | "good" | "warn" | "bad";
  className?: string;
}

function KpiTileImpl({
  label, value, unit, foot, tone = "neutral", className,
}: KpiTileProps): ReactNode {
  const rule = tone === "good" ? vizColor.execute
             : tone === "warn" ? vizColor.warn
             : tone === "bad"  ? vizColor.danger
             :                   vizColor.line;

  return createElement("div", {
    className,
    style: {
      borderLeft: `2px solid ${rule}`,
      padding: "10px 14px",
      background: vizColor.raised,
      borderRadius: 4,
      display: "flex", flexDirection: "column", gap: 4,
      minWidth: 120,
    },
  }, [
    createElement("span", {
      key: "label",
      style: {
        font: `10px ${vizFont.body}`,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: vizColor.ink3,
      },
    }, label),
    createElement("span", {
      key: "value",
      style: {
        font: `20px ${vizFont.mono}`,
        color: vizColor.ink,
        fontVariantNumeric: "tabular-nums",
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
      },
    }, [
      createElement("span", { key: "v" }, value as ReactNode),
      unit ? createElement("span", {
        key: "u",
        style: {
          font: `11px ${vizFont.body}`,
          color: vizColor.ink3,
        },
      }, unit) : null,
    ]),
    foot ? createElement("span", {
      key: "foot",
      style: {
        font: `11px ${vizFont.body}`,
        color: vizColor.ink2,
      },
    }, foot as ReactNode) : null,
  ]);
}

export const KpiTile = memo(KpiTileImpl);
(KpiTile as { displayName?: string }).displayName = "KpiTile";

// ─────────────────────────────────────────────────────────────────
// DeltaTile
// ─────────────────────────────────────────────────────────────────

export interface DeltaTileProps {
  label: string;
  /** Current value (already formatted). */
  value: ReactNode;
  /** Signed numeric delta. Sign drives arrow + colour. */
  delta: number;
  /** Delta unit (e.g. "%", "bps"). */
  deltaUnit?: string;
  /** Decimal places for delta. Default 2. */
  precision?: number;
  /** Inverts colour mapping — negative = good (e.g. latency). */
  invert?: boolean;
  className?: string;
}

function DeltaTileImpl({
  label, value, delta, deltaUnit = "%", precision = 2, invert = false, className,
}: DeltaTileProps): ReactNode {
  const positive = delta > 0;
  const zero = delta === 0;
  const good = invert ? !positive : positive;
  const colour = zero ? vizColor.ink3
               : good ? vizColor.execute
               :        vizColor.danger;
  const arrow = zero ? "·" : positive ? "▲" : "▼";
  const sign = positive ? "+" : "";

  return createElement("div", {
    className,
    style: {
      padding: "10px 14px",
      background: vizColor.raised,
      borderRadius: 4,
      display: "flex", flexDirection: "column", gap: 4,
      minWidth: 120,
    },
  }, [
    createElement("span", {
      key: "label",
      style: {
        font: `10px ${vizFont.body}`,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: vizColor.ink3,
      },
    }, label),
    createElement("span", {
      key: "value",
      style: {
        font: `20px ${vizFont.mono}`,
        color: vizColor.ink,
        fontVariantNumeric: "tabular-nums",
      },
    }, value as ReactNode),
    createElement("span", {
      key: "delta",
      style: {
        font: `11px ${vizFont.mono}`,
        color: colour,
        fontVariantNumeric: "tabular-nums",
        display: "inline-flex", alignItems: "center", gap: 4,
      },
    }, [
      createElement("span", { key: "a", "aria-hidden": "true" }, arrow),
      createElement("span", { key: "n" },
        `${sign}${delta.toFixed(precision)}${deltaUnit}`),
    ]),
  ]);
}

export const DeltaTile = memo(DeltaTileImpl);
(DeltaTile as { displayName?: string }).displayName = "DeltaTile";

// ─────────────────────────────────────────────────────────────────

function formatNumber(n: number, precision?: number, group = true): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping: group,
  });
}

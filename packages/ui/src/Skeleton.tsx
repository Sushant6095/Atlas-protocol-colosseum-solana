// <Skeleton> — layout-stable placeholders. Six variants:
//   Line, Number, Block, Row, Card, Chart.
// CSS-only pulse via @keyframes atlas-ui-skeleton, registered
// inside the file so the component is self-contained.

"use client";

import { memo } from "react";
import { clsx } from "clsx";

const BASE = "block rounded-[2px]";
const STYLE: React.CSSProperties = {
  background: "var(--color-line-soft)",
  animation: "atlas-ui-skeleton 1.4s ease-in-out infinite",
};

function Inject(): JSX.Element {
  return (
    <style>{`
      @keyframes atlas-ui-skeleton {
        0%,100% { opacity: 0.6; }
        50%     { opacity: 1.0; }
      }
      @media (prefers-reduced-motion: reduce) {
        [data-atlas-skeleton] { animation: none !important; opacity: 0.7 !important; }
      }
    `}</style>
  );
}

interface BaseProps {
  className?: string;
  width?: number | string;
}

function LineImpl({ width = "100%", className }: BaseProps): JSX.Element {
  return (
    <span
      data-atlas-skeleton
      aria-hidden
      className={clsx(BASE, "h-[12px]", className)}
      style={{ ...STYLE, width }}
    />
  );
}
const Line = memo(LineImpl);

function NumberImpl({
  size = "lg", width, className,
}: BaseProps & { size?: "sm" | "md" | "lg" | "xl" | "hero" }): JSX.Element {
  const h = size === "hero" ? 56 : size === "xl" ? 44 : size === "lg" ? 32 : size === "md" ? 22 : 16;
  return (
    <span
      data-atlas-skeleton
      aria-hidden
      className={clsx(BASE, className)}
      style={{ ...STYLE, height: h, width: width ?? "60%" }}
    />
  );
}
const NumberSk = memo(NumberImpl);

function BlockImpl({
  height = 120, width = "100%", className,
}: BaseProps & { height?: number }): JSX.Element {
  return (
    <div
      data-atlas-skeleton
      aria-hidden
      className={clsx(BASE, "rounded-[var(--radius-sm)]", className)}
      style={{ ...STYLE, height, width }}
    />
  );
}
const Block = memo(BlockImpl);

function RowImpl({
  cols = 4, className,
}: { cols?: number; className?: string }): JSX.Element {
  return (
    <div
      aria-hidden
      className={clsx("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Line key={i} width={`${60 + ((i * 7) % 30)}%`} />
      ))}
    </div>
  );
}
const Row = memo(RowImpl);

function CardImpl({ height = 220, className }: { height?: number; className?: string }): JSX.Element {
  return (
    <div
      aria-hidden
      className={clsx("rounded-[var(--radius-lg)] border p-6 flex flex-col gap-3", className)}
      style={{
        height,
        background: "var(--color-surface-raised)",
        borderColor: "var(--color-line-medium)",
      }}
    >
      <Line width="40%" />
      <NumberSk size="hero" width="60%" />
      <Line width="80%" />
      <Line width="50%" />
    </div>
  );
}
const Card = memo(CardImpl);

function ChartImpl({ height = 280, bars = 10, className }: { height?: number; bars?: number; className?: string }): JSX.Element {
  return (
    <div
      aria-hidden
      className={clsx("rounded-[var(--radius-md)] border p-6 flex items-end gap-2", className)}
      style={{
        height,
        background: "var(--color-surface-raised)",
        borderColor: "var(--color-line-medium)",
      }}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          data-atlas-skeleton
          className="flex-1 rounded-[2px]"
          style={{ ...STYLE, height: `${20 + ((i * 13) % 70)}%` }}
        />
      ))}
    </div>
  );
}
const Chart = memo(ChartImpl);

export const Skeleton = Object.assign({ Line, Number: NumberSk, Block, Row, Card, Chart, Inject }, {});

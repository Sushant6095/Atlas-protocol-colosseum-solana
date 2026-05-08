// Skeleton — layout-stable placeholders that match the eventual
// content's column widths and row heights so the page never shifts
// when data lands.
//
// Animation is CSS-only (`@keyframes atlas-pulse`); no JS RAF loop.
// `prefers-reduced-motion: reduce` collapses the pulse to a static
// fill (handled in globals.css).
//
// Avoid generic shimmer rectangles — every consumer should pick the
// correct sub-primitive (`Skeleton.Line`, `Skeleton.Number`,
// `Skeleton.Block`, `Skeleton.Row`) so the silhouette of loading
// state matches the loaded layout.

import { memo } from "react";
import { cn } from "./cn";

export interface SkeletonBaseProps {
  className?: string;
  /** Inline width override (px or CSS string). */
  width?: number | string;
}

const BASE_CLASS =
  "block rounded-[2px] bg-[color:var(--color-line-soft)] animate-[atlas-pulse_1.6s_ease-in-out_infinite]";

/** A single text line. */
function LineImpl({ width = "100%", className }: SkeletonBaseProps): JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(BASE_CLASS, "h-[12px]", className)}
      style={{ width }}
    />
  );
}
const Line = memo(LineImpl);
Line.displayName = "Skeleton.Line";

/** A mono-numeric placeholder sized to a KPI tile. */
function NumberImpl({
  size = "lg", width, className,
}: SkeletonBaseProps & { size?: "sm" | "md" | "lg" | "xl" | "hero" }): JSX.Element {
  const h = size === "hero" ? 48 : size === "xl" ? 36 : size === "lg" ? 28 : size === "md" ? 22 : 18;
  return (
    <span
      aria-hidden
      className={cn(BASE_CLASS, className)}
      style={{ height: h, width: width ?? "60%" }}
    />
  );
}
const NumberSkeleton = memo(NumberImpl);
NumberSkeleton.displayName = "Skeleton.Number";

/** A panel-sized rectangle. */
function BlockImpl({
  height = 120, width = "100%", className,
}: SkeletonBaseProps & { height?: number }): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(BASE_CLASS, "rounded-[var(--radius-sm)]", className)}
      style={{ height, width }}
    />
  );
}
const Block = memo(BlockImpl);
Block.displayName = "Skeleton.Block";

/** A row of N cells of equal width — table row stand-in. */
function RowImpl({
  cols = 4, className,
}: { cols?: number; className?: string }): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Line key={i} width={`${60 + ((i * 7) % 30)}%`} />
      ))}
    </div>
  );
}
const Row = memo(RowImpl);
Row.displayName = "Skeleton.Row";

export const Skeleton = {
  Line,
  Number: NumberSkeleton,
  Block,
  Row,
};

// Skeleton — layout-preserving loading placeholders (Phase 21 §12.1).
//
// Skeletons reproduce column widths, row heights, chart axes so
// content arrival doesn't shift the layout. Animation is a single
// CSS shimmer keyed off tokens — collapses to flat under reduced
// motion (the global rule in globals.css).

"use client";

import { memo } from "react";
import { cn } from "@/components/primitives";

export interface SkeletonProps {
  className?: string;
  /** Render as inline-block instead of block. Useful inside text. */
  inline?: boolean;
}

function SkeletonImpl({ className, inline }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        inline ? "inline-block" : "block",
        "rounded-[var(--radius-xs)]",
        "bg-[color:var(--color-line-medium)]",
        "animate-[atlas-skeleton_1.4s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}

export const Skeleton = memo(SkeletonImpl);
Skeleton.displayName = "Skeleton";

export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  className,
}: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
});

export const SkeletonRow = memo(function SkeletonRow({
  cols = 4,
}: { cols?: number }) {
  return (
    <div
      className="grid gap-3 py-3 border-b border-[color:var(--color-line-soft)]"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4" />
      ))}
    </div>
  );
});

export const SkeletonChart = memo(function SkeletonChart({
  className,
}: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full h-[260px] rounded-[var(--radius-md)]",
        "border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-sunken)]",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-x-6 inset-y-8 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-1", `w-${["1/2", "2/3", "3/4", "4/5"][i] ?? "full"}`)}
          />
        ))}
      </div>
    </div>
  );
});

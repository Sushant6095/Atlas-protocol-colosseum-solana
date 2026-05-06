// InlineErrorPill — fallback for a single panel that fails its query
// (Phase 21 §12.3 fallback level 1).
//
// The rest of the page is unaffected. Caller passes a retry callback
// (typically `query.refetch`).

"use client";

import { memo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/components/primitives";

export interface InlineErrorPillProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

function InlineErrorPillImpl({ message, onRetry, className }: InlineErrorPillProps) {
  return (
    <div
      role="alert"
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)]",
        "border border-[color:var(--color-accent-danger)]/30",
        "bg-[color:var(--color-accent-danger)]/10",
        "text-[12px] text-[color:var(--color-accent-danger)]",
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      <span className="font-mono">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 inline-flex items-center gap-1 hover:underline"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          retry
        </button>
      ) : null}
    </div>
  );
}

export const InlineErrorPill = memo(InlineErrorPillImpl);
InlineErrorPill.displayName = "InlineErrorPill";

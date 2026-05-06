// RouteErrorBoundary — Next.js App Router `error.tsx` content
// (Phase 21 §12.3 fallback level 2).
//
// Caller wires this from each route group's `error.tsx`. Renders a
// route-level surface with a copyable trace id; the rest of the
// chrome (header, etc.) lives in the route group's layout and is
// preserved.

"use client";

import { memo, useCallback } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";

export interface RouteErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function RouteErrorBoundaryImpl({ error, reset }: RouteErrorBoundaryProps) {
  const trace = error.digest ?? mkTraceId();
  const onCopy = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(trace).catch(() => {});
    }
  }, [trace]);
  return (
    <div className="px-6 py-12 max-w-[768px] mx-auto">
      <Panel surface="raised" density="default" accent="danger">
        <h1 className="text-display text-[24px] mb-2">
          Something didn&apos;t render.
        </h1>
        <p className="text-[14px] text-[color:var(--color-ink-secondary)]">
          The page-level fallback caught an error. The rest of the app
          is unaffected. If this keeps happening, send us the trace
          id.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={reset}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" />
            Copy trace
          </Button>
          <IdentifierMono value={trace} size="sm" copy />
        </div>
      </Panel>
    </div>
  );
}

export const RouteErrorBoundary = memo(RouteErrorBoundaryImpl);
RouteErrorBoundary.displayName = "RouteErrorBoundary";

function mkTraceId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

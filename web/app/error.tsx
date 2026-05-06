"use client";

import { RouteErrorBoundary } from "@/components/system";

export default function GlobalError({
  error,
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorBoundary error={error} reset={reset} />;
}

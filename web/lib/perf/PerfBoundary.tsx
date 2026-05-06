// PerfBoundary — drop one of these at the root of every route's
// client wrapper. Initialises Web Vitals reporting, the long-task
// watcher, and the dev-only memory inspector for the route's class.
//
// Usage:
//   "use client";
//   import { PerfBoundary } from "@/lib/perf/PerfBoundary";
//   export default function ClientShell({ children }: { children: ReactNode }) {
//     return <PerfBoundary routeClass="operator" routeLabel="vault.{id}">{children}</PerfBoundary>;
//   }

"use client";

import { useEffect, type ReactNode } from "react";
import { initVitals, type RouteClass } from "./vitals";
import { useLongTaskWatcher } from "./long-task";
import { useMemoryInspector } from "./memory-inspector";

interface Props {
  routeClass: RouteClass;
  routeLabel: string;
  children: ReactNode;
}

export function PerfBoundary({ routeClass, routeLabel, children }: Props) {
  useEffect(() => { void initVitals(routeClass); }, [routeClass]);
  useLongTaskWatcher(routeLabel);
  useMemoryInspector(routeLabel);
  return children;
}

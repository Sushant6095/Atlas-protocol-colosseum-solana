// Shared shell types (Phase 21 §4).

import type { ReactNode } from "react";

export interface ShellProps {
  children: ReactNode;
}

export type ShellSurface =
  | "marketing"
  | "public"
  | "intelligence"
  | "terminal"
  | "docs";

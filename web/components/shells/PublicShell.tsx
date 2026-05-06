// PublicShell (Phase 21 §4.2).
//
// Minimal header, no auth prompt, "Live" pill in corner showing
// realtime status. Used for /infra, /proofs/live, /decision-engine.

import type { ShellProps } from "./types";
import { HeaderBar } from "./HeaderBar";

export function PublicShell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--color-surface-base)]">
      <HeaderBar compact />
      <main className="px-6 py-10 max-w-[1440px] mx-auto">{children}</main>
    </div>
  );
}

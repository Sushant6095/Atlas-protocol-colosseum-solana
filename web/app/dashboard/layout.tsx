// /dashboard layout.
//
// Sits at the app root (no route group), so it inherited only the
// chrome-less root layout. This wrapper drops it into the same
// PublicShell as /decision-engine and /vaults so the Atlas
// wordmark, Product mega-menu, and Architecture / Security /
// Decision Engine / Docs anchors are always one click away.

import { PublicShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

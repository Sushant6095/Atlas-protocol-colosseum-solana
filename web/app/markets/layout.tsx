// /markets layout — covers /markets and /markets/[pool].
//
// Both pages sat at the app root with no chrome before. Wrapping
// them in PublicShell gives them the same Atlas-wide header as
// /decision-engine and /vaults.

import { PublicShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function MarketsLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

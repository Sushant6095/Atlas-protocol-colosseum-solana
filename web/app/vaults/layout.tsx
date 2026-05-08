// /vaults layout.
//
// /vaults and /vaults/[symbol] live at the app root (no route
// group), so they only inherited the chrome-less root layout. This
// layout wraps them in the same PublicShell as /decision-engine so
// every viewer can use the Atlas wordmark, Product mega-menu, and
// Architecture / Security / Decision Engine / Docs anchors to
// navigate back.

import { PublicShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function VaultsLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

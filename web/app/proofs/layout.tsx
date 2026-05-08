// /proofs layout.
//
// /proofs at the app root was chrome-less; /proofs/live in the
// (public) group already has PublicShell. This makes the two
// sibling URLs visually consistent.

import { PublicShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function ProofsLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

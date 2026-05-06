import { IntelligenceShell } from "@/components/shells";
import type { ReactNode } from "react";

// Account uses the IntelligenceShell — same chrome, no dense terminal feel.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <IntelligenceShell>{children}</IntelligenceShell>;
}

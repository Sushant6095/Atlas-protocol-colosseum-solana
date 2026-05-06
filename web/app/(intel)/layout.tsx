import { IntelligenceShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function IntelLayout({ children }: { children: ReactNode }) {
  return <IntelligenceShell>{children}</IntelligenceShell>;
}

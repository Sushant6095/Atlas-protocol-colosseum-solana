import { TerminalShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function GovernanceLayout({ children }: { children: ReactNode }) {
  return <TerminalShell>{children}</TerminalShell>;
}

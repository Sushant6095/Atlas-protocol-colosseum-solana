import { TerminalShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function TreasuryLayout({ children }: { children: ReactNode }) {
  return <TerminalShell>{children}</TerminalShell>;
}

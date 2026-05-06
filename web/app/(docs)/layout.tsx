import { DocsShell } from "@/components/shells";
import type { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}

// Route-group passthrough.
//
// The full Kamino-quality docs shell lives at the more specific
// `app/(docs)/docs/layout.tsx`. Routes inside this group that don't
// fall under /docs (legacy /playground, /webhooks) render with no
// chrome here so they can pick whatever wrapper they need — most
// of them simply redirect to their /docs/* equivalents.

import type { ReactNode } from "react";

export default function DocsGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

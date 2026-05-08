// Legacy /webhooks route. The page now lives under /docs/webhooks
// inside the new docs shell. Permanently redirect.

import { redirect } from "next/navigation";

export default function LegacyWebhooksRedirect(): never {
  redirect("/docs/webhooks");
}

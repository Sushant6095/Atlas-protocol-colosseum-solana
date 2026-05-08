// Legacy /playground route. The playground now lives under
// /docs/playground inside the new docs shell. Permanently redirect
// any bookmarked or linked traffic.

import { redirect } from "next/navigation";

export default function LegacyPlaygroundRedirect(): never {
  redirect("/docs/playground");
}

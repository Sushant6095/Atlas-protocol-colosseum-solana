// dev.atlasfi.in — landing after sign-in redirects to /projects.
// This page only renders if the layout's auth gate fails, which
// shouldn't happen in practice. Redirect at the route boundary.

import { redirect } from "next/navigation";

export default function Page(): never {
  redirect("/projects");
}

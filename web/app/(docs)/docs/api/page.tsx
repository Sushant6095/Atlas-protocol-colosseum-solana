// /docs/api — REST and WebSocket reference.
//
// The auto-generated OpenAPI render is wired in a follow-up; for
// now we ship a stable description + outbound link so the route
// has a real, copy-able landing page inside the new docs shell.

"use client";

import Link from "next/link";
import { DocPage } from "@/components/docs";

const MARKDOWN_SOURCE = `---
title: "REST API"
description: "REST and WebSocket endpoints for Atlas."
---
# REST API

Atlas exposes 45 REST endpoints and 2 WebSocket streams. The full
OpenAPI document is published with every release.

- See [/docs/playground](/docs/playground) to try requests live.
- See [/docs/sdk](/docs/sdk) for typed clients.
`;

export default function ApiReferencePage(): JSX.Element {
  return (
    <DocPage
      title="REST API"
      description="REST and WebSocket endpoints for the Atlas platform."
      markdown={MARKDOWN_SOURCE}
    >
      <p>
        Atlas exposes 45 REST endpoints and 2 WebSocket streams. The
        full OpenAPI document is published with every release; the
        live spec render lands in the next docs PR.
      </p>

      <h2>Try it</h2>
      <p>
        The interactive console at{" "}
        <Link href="/docs/playground">/docs/playground</Link> ships a
        request panel for every endpoint with live response and copy
        as cURL / TypeScript / Rust.
      </p>

      <h2>Typed clients</h2>
      <p>
        For TypeScript and Rust clients, see{" "}
        <Link href="/docs/sdk">/docs/sdk</Link>. Both clients share a
        request shape so a snippet from one ports cleanly to the
        other.
      </p>

      <h2>Webhooks</h2>
      <p>
        Atlas signs every webhook payload with HMAC plus a replay
        window. Configuration UI is at{" "}
        <Link href="/docs/webhooks">/docs/webhooks</Link>.
      </p>
    </DocPage>
  );
}

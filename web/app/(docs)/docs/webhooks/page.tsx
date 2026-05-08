// /docs/webhooks — signed payloads, HMAC + replay window.

"use client";

import Link from "next/link";
import { DocPage } from "@/components/docs";

const MARKDOWN_SOURCE = `---
title: "Webhooks"
description: "Signed payloads with HMAC and a replay window."
---
# Webhooks

Atlas signs every webhook payload with an HMAC of the body plus a
replay window so the receiver can reject stale or replayed events.

The management UI lands in a follow-up; the wire format is stable.
See [/docs/api](/docs/api) for the event shapes.
`;

export default function WebhooksPage(): JSX.Element {
  return (
    <DocPage
      title="Webhooks"
      description="Signed payloads with HMAC and a replay window."
      markdown={MARKDOWN_SOURCE}
    >
      <p>
        Atlas signs every webhook payload with an HMAC of the body
        plus a replay window so the receiver can reject stale or
        replayed events. The management UI ships in a follow-up; the
        wire format is stable.
      </p>

      <h2>Event shapes</h2>
      <p>
        See <Link href="/docs/api">/docs/api</Link> for every event
        shape. Each delivery includes the {`X-Atlas-Signature`} and
        {` X-Atlas-Timestamp`} headers; reject anything older than 5
        minutes after parsing the body.
      </p>

      <h2>Verifying a signature</h2>
      <pre>
        <code>{`import crypto from "node:crypto";

function verify(body: string, sig: string, ts: string, secret: string): boolean {
  const window = Math.abs(Date.now() / 1000 - Number(ts));
  if (window > 300) return false;            // 5-minute replay window
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${ts}.\${body}\`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}`}</code>
      </pre>
    </DocPage>
  );
}

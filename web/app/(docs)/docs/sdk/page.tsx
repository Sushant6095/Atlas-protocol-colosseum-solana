// /docs/sdk — TypeScript and Rust SDK overview.

"use client";

import Link from "next/link";
import { DocPage } from "@/components/docs";

const MARKDOWN_SOURCE = `---
title: "SDK reference"
description: "TypeScript and Rust SDKs for Atlas."
---
# SDK reference

TypeScript: \`@atlas/sdk\`, \`@atlas/widgets\`, \`@atlas/qvac\`.
Rust: \`atlas-rs\`. PDA helpers, proof-shape verifier, /api/v1
client.

- TypeScript guide: [/docs/sdk/typescript](/docs/sdk/typescript)
- Rust guide: [/docs/sdk/rust](/docs/sdk/rust)
- Verify a proof client-side: [/docs/sdk/verify-proof](/docs/sdk/verify-proof)
`;

export default function SdkOverviewPage(): JSX.Element {
  return (
    <DocPage
      title="SDK reference"
      description="TypeScript and Rust SDKs for working with Atlas."
      markdown={MARKDOWN_SOURCE}
    >
      <p>
        Atlas ships first-party SDKs for the two languages most of
        the integrators write in: TypeScript for browsers and Node,
        Rust for on-chain programs and high-throughput services.
      </p>

      <h2>TypeScript</h2>
      <p>
        <code>@atlas/sdk</code> is the platform client. It wraps the
        REST and WebSocket surface, exposes typed responses, and
        bundles a pure-JS proof-shape verifier. <code>@atlas/widgets</code>
        is the embed library; <code>@atlas/qvac</code> ships the
        on-device wallet-intelligence analyst.
      </p>
      <p>
        Full guide: <Link href="/docs/sdk/typescript">@atlas/sdk</Link>.
      </p>

      <h2>Rust</h2>
      <p>
        <code>atlas-rs</code> mirrors the TypeScript surface and adds
        PDA helpers, an on-chain proof-shape verifier, and the
        verify-inference CPI primitive any Solana program can call.
      </p>
      <p>
        Full guide: <Link href="/docs/sdk/rust">atlas-rs</Link>.
      </p>

      <h2>Verify a proof client-side</h2>
      <p>
        For the standalone WASM verifier flow, see{" "}
        <Link href="/docs/sdk/verify-proof">verify a proof</Link>.
      </p>
    </DocPage>
  );
}

// /docs/quickstart — five minutes from install to a verified call.
// Content originally lived at /docs; preserved here when the home
// page was rewritten so judges and integrators don't lose the
// fastest path through the platform.

"use client";

import Link from "next/link";
import { DocPage } from "@/components/docs";

const MARKDOWN_SOURCE = `---
title: "Quickstart"
description: "Five minutes from install to a verified Atlas call."
---
# Quickstart

Install \`@atlas/sdk\`, read a vault, verify a proof, subscribe to a
live stream. Five minutes.

## Install

\`\`\`bash
pnpm add @atlas/sdk
# optional helpers
pnpm add @atlas/widgets @atlas/qvac
\`\`\`

## Read your first vault

\`\`\`ts
import { AtlasPlatform } from "@atlas/sdk";
const atlas = new AtlasPlatform({ baseUrl: "https://atlas.fyi" });

const vault = await atlas.getVault("0xab12...");
console.log(vault.allocation);
\`\`\`

## Verify a proof client-side

\`\`\`ts
const proof = await atlas.getProof(publicInputHash);
atlas.verifyProof(proof); // throws on shape errors
// hand to sp1-solana for the cryptographic check
\`\`\`

## Subscribe to a live stream

\`\`\`ts
const ws = atlas.streamRebalances(vaultId, (e) => {
  if (e.proof_status === "verified") render(e);
});
// later
ws.close();
\`\`\`

## Concepts

- Vault — custody account with an immutable strategy commitment.
- Rebalance — atomic capital movement bound to an SP1 / Groth16 proof.
- Public input — fixed-size payload folded into the proof.
- Disclosure policy — who sees what; hashes into the public input.
- PER session — private execution; settles to mainnet within 256 slots.
`;

const CONCEPTS: ReadonlyArray<{ name: string; blurb: string }> = [
  { name: "Vault",            blurb: "Custody account with an immutable strategy commitment." },
  { name: "Rebalance",        blurb: "Atomic capital movement. Bound to an SP1 / Groth16 proof." },
  { name: "Public input",     blurb: "Fixed-size payload folded into the proof." },
  { name: "Disclosure policy",blurb: "Who sees what. Hashes into the public input." },
  { name: "PER session",      blurb: "Private execution; settles to mainnet within 256 slots." },
];

const COOKBOOK = [
  { tag: "deposit",  title: "Connect a wallet, deposit USDC", desc: "Walks the SIWS auth flow and a simulate-then-sign deposit ix." },
  { tag: "verify",   title: "Verify a proof in the browser",  desc: "Loads a Groth16 receipt; runs sp1-solana through WASM." },
  { tag: "alerts",   title: "Watch alerts via WebSocket",     desc: "Subscribes stream.vault.{id}.alert; renders in any UI." },
  { tag: "widgets",  title: "Embed /infra widgets",            desc: "Drop the @atlas/widgets iframe into a status page." },
  { tag: "intel",    title: "Score a wallet locally",          desc: "Runs the QVAC analyst on-device, no calls home." },
  { tag: "treasury", title: "Open a treasury vault",           desc: "Squads multisig wizard plus KYB if business." },
];

export default function QuickstartPage(): JSX.Element {
  return (
    <DocPage
      title="Quickstart"
      description="Five minutes from install to a verified Atlas call."
      markdown={MARKDOWN_SOURCE}
    >
      <h2>Install</h2>
      <pre>
        <code>{`pnpm add @atlas/sdk
# optional helpers
pnpm add @atlas/widgets @atlas/qvac`}</code>
      </pre>

      <h2>Read your first vault</h2>
      <pre>
        <code>{`import { AtlasPlatform } from "@atlas/sdk";
const atlas = new AtlasPlatform({ baseUrl: "https://atlas.fyi" });

const vault = await atlas.getVault("0xab12...");
console.log(vault.allocation);`}</code>
      </pre>

      <h2>Verify a proof client-side</h2>
      <pre>
        <code>{`const proof = await atlas.getProof(publicInputHash);
atlas.verifyProof(proof); // throws on shape errors
// hand to sp1-solana for the cryptographic check`}</code>
      </pre>

      <h2>Subscribe to a live stream</h2>
      <pre>
        <code>{`const ws = atlas.streamRebalances(vaultId, (e) => {
  if (e.proof_status === "verified") render(e);
});
// later
ws.close();`}</code>
      </pre>

      <h2>Concepts</h2>
      <ul className="not-prose grid gap-3 sm:grid-cols-2 my-6">
        {CONCEPTS.map((c) => (
          <li
            key={c.name}
            className="rounded-[var(--radius-md)] border p-4"
            style={{
              borderColor: "var(--color-line-soft)",
              background: "var(--color-surface-raised)",
            }}
          >
            <p className="font-display font-semibold text-[14px]" style={{ color: "var(--color-ink-primary)" }}>
              {c.name}
            </p>
            <p className="mt-1 text-[13px] leading-[1.5]" style={{ color: "var(--color-ink-secondary)" }}>
              {c.blurb}
            </p>
          </li>
        ))}
      </ul>

      <h2>Cookbook</h2>
      <ul className="not-prose grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
        {COOKBOOK.map((c) => (
          <li
            key={c.title}
            className="rounded-[var(--radius-md)] border p-4"
            style={{
              borderColor: "var(--color-line-soft)",
              background: "var(--color-surface-raised)",
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--color-ink-tertiary)" }}>
              {c.tag}
            </p>
            <p className="mt-1 text-[14px]" style={{ color: "var(--color-ink-primary)" }}>{c.title}</p>
            <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: "var(--color-ink-secondary)" }}>{c.desc}</p>
          </li>
        ))}
      </ul>

      <h2>References</h2>
      <ul className="not-prose space-y-1 text-[13px] my-4">
        <li><Link href="/docs/api" className="text-[color:var(--color-accent-electric)]">REST API reference</Link></li>
        <li><Link href="/docs/sdk" className="text-[color:var(--color-accent-electric)]">SDK reference (TS + Rust)</Link></li>
        <li><Link href="/docs/widgets" className="text-[color:var(--color-accent-electric)]">Embeddable widgets</Link></li>
        <li><Link href="/docs/shortcuts" className="text-[color:var(--color-accent-electric)]">Keyboard shortcuts</Link></li>
        <li><Link href="/docs/playground" className="text-[color:var(--color-accent-electric)]">Interactive console</Link></li>
      </ul>
    </DocPage>
  );
}

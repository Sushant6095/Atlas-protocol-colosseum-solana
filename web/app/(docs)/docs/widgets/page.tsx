// /docs/widgets — embeddable widgets gallery.
//
// Live previews + ready-to-paste embed snippets for every named
// @atlas/widgets surface. Each card renders the actual widget with
// a public Atlas demo deployment so partners can see the data they'd
// get without standing up an integration first.

"use client";

import { Panel } from "@/components/primitives/Panel";
import { WidgetPreview } from "@/components/qvac-docs/WidgetPreview";
import { DocPage } from "@/components/docs";

interface Entry {
  kind: string;
  title: string;
  description: string;
  needsVault: boolean;
  embedSnippet: string;
  iframeSnippet: string;
}

const DEMO_BASE = "https://demo.atlas.fyi";
const DEMO_VAULT = "0x46c1f2c7e5c7e51b2a2cb0b1c4f2f6f7f9b1c2d3e4f5061728394a5b6c7d8e90";

function ENTRIES(base: string, vault: string): Entry[] {
  return [
    {
      kind: "slot-freshness",
      title: "Slot Freshness",
      description: "Live freshness budget for one vault — slots remaining vs the 150-slot stale threshold.",
      needsVault: true,
      embedSnippet: tag("slot-freshness", base, vault),
      iframeSnippet: iframe(`${base}/sdk/playground/freshness.html?embed=1&vault=${vault}`, 220),
    },
    {
      kind: "rpc-latency",
      title: "RPC Latency",
      description: "Tier-A vs Tier-B p99 with budget colour bands. Refreshes every 5s.",
      needsVault: false,
      embedSnippet: tag("rpc-latency", base),
      iframeSnippet: iframe(`${base}/sdk/playground/infra.html?embed=1&panel=rpc-latency`, 200),
    },
    {
      kind: "proof-gen-latency",
      title: "Proof-gen Latency",
      description: "Current p50/p99 proof generation against the 75s SLO.",
      needsVault: false,
      embedSnippet: tag("proof-gen-latency", base),
      iframeSnippet: iframe(`${base}/sdk/playground/infra.html?embed=1&panel=proof-gen`, 200),
    },
    {
      kind: "bundle-landed-rate",
      title: "Bundle Landed Rate",
      description: "Last-5m landed-bundle ratio with healthy / warn / bad colour bands.",
      needsVault: false,
      embedSnippet: tag("bundle-landed-rate", base),
      iframeSnippet: iframe(`${base}/sdk/playground/infra.html?embed=1&panel=bundle-landed`, 220),
    },
    {
      kind: "tps",
      title: "Solana TPS",
      description: "True TPS + vote-removed TPS. Same series the public Observatory shows.",
      needsVault: false,
      embedSnippet: tag("tps", base),
      iframeSnippet: iframe(`${base}/sdk/playground/infra.html?embed=1&panel=tps`, 200),
    },
    {
      kind: "last-rebalance",
      title: "Last Rebalance",
      description: "Most recent rebalance event for one vault — slot, ratio diff summary, proof status.",
      needsVault: true,
      embedSnippet: tag("last-rebalance", base, vault),
      iframeSnippet: iframe(`${base}/sdk/playground/freshness.html?embed=1&vault=${vault}&panel=last-rebalance`, 240),
    },
    {
      kind: "proof-of-reserve",
      title: "Proof of Reserve",
      description: "Most recent reserve attestation: attested vs reported balance + delta + age.",
      needsVault: true,
      embedSnippet: tag("proof-of-reserve", base, vault),
      iframeSnippet: iframe(`${base}/sdk/playground/freshness.html?embed=1&vault=${vault}&panel=proof-of-reserve`, 220),
    },
  ];
}

function tag(kind: string, base: string, vault?: string): string {
  const vAttr = vault ? `\n  vault-id="${vault}"` : "";
  return `<script type="module" src="${base}/sdk/widgets/web-component.js"></script>
<atlas-widget
  kind="${kind}"
  base-url="${base}"${vAttr}
  theme="dark"
  refresh-ms="5000">
</atlas-widget>`;
}

function iframe(src: string, height: number): string {
  return `<iframe
  src="${src}"
  loading="lazy"
  width="100%"
  height="${height}"
  style="border:1px solid var(--color-line);border-radius:6px"
  title="Atlas widget"></iframe>`;
}

const MARKDOWN_SOURCE = `---
title: "Embeddable widgets"
description: "Drop a single tag on any page to render live Atlas data."
---
# Embeddable widgets

Each widget renders against a public Atlas demo deployment. Pick a
web-component tag, an iframe, or the typed React hook from
\`@atlas/widgets\`. See the catalog below for every surface.
`;

export default function Page(): JSX.Element {
  const entries = ENTRIES(DEMO_BASE, DEMO_VAULT);
  return (
    <DocPage
      title="Live Atlas data on any page."
      description={
        <>Each widget below is rendering against <code className="font-mono">{DEMO_BASE}</code> right now. Pick the embed style you prefer — a single web-component tag, an iframe, or the typed React hook from <code className="font-mono">@atlas/widgets</code>.</>
      }
      markdown={MARKDOWN_SOURCE}
    >
      <h2 className="not-prose text-display text-[22px] mt-2 mb-3">Quick start</h2>
      <pre className="not-prose font-mono text-[12px] leading-[18px] p-4 rounded
                     bg-[color:var(--color-surface-sunken)]
                     border border-[color:var(--color-line-soft)] overflow-auto">
{`pnpm add @atlas/widgets

import "@atlas/widgets/web-component";
// then drop <atlas-widget kind="..." base-url="..." /> anywhere.`}
      </pre>

      <h2 className="not-prose text-display text-[22px] mt-10 mb-3">Catalog</h2>
      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map((e) => (
          <Panel key={e.kind} surface="raised" density="default">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              {e.kind}
            </p>
            <h3 className="text-[16px] text-[color:var(--color-ink-primary)] mt-1">
              {e.title}
            </h3>
            <p className="text-[12px] text-[color:var(--color-ink-secondary)] mt-1">
              {e.description}
            </p>

            <div className="mt-4">
              <WidgetPreview kind={e.kind} baseUrl={DEMO_BASE}
                             vaultId={e.needsVault ? DEMO_VAULT : undefined} />
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.06em]
                                    text-[color:var(--color-ink-tertiary)]">
                web-component snippet
              </summary>
              <pre className="font-mono text-[11px] leading-[16px] mt-2 p-3 rounded
                              bg-[color:var(--color-surface-sunken)]
                              border border-[color:var(--color-line-soft)] overflow-auto">
{e.embedSnippet}
              </pre>
            </details>

            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.06em]
                                    text-[color:var(--color-ink-tertiary)]">
                iframe fallback
              </summary>
              <pre className="font-mono text-[11px] leading-[16px] mt-2 p-3 rounded
                              bg-[color:var(--color-surface-sunken)]
                              border border-[color:var(--color-line-soft)] overflow-auto">
{e.iframeSnippet}
              </pre>
            </details>
          </Panel>
        ))}
      </div>

      <h2 className="not-prose text-display text-[22px] mt-12 mb-3">Theming</h2>
      <p className="not-prose text-[14px] text-[color:var(--color-ink-secondary)]">
        Widgets read three CSS variables: <code>--atlas-bg</code>,{" "}
        <code>--atlas-border</code>, <code>--atlas-fg</code>. Set them
        on the parent element to match your design system, or pass
        <code> theme=&quot;light&quot;</code> for the bundled light variant.
      </p>
    </DocPage>
  );
}

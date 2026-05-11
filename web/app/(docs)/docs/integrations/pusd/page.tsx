// /docs/integrations/pusd — press-quality integration page.
//
// PUSD is Atlas's primary reserve. This doc proves depth: 12 recipes,
// Token-2022 extension manifest, 6 Prometheus metrics, drift-check CI
// binary, and the declared hard rule that gates the PUSD claim.

"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles, ShieldCheck, FileWarning } from "lucide-react";
import { DocPage } from "@/components/docs";

const PUSD = "#A682FF";

const GITHUB_PUSD_RS =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/crates/atlas-assets/src/pusd.rs";
const CONFIDENTIAL_TREASURY_MD =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/CONFIDENTIAL-TREASURY.md";

const MARKDOWN_SOURCE = `---
title: "PUSD — Palm USD"
description: "Atlas is PUSD-native. Not 'we also support PUSD'."
---
# Atlas is PUSD-native

4 strategies × 3 risk bands = 12 vault recipes, every recipe
denominated, settled, and rebalanced in PUSD.

## Declared hard rule

no PUSD-native vault → no PUSD claim

A vault that holds PUSD as collateral but routes yield through
non-PUSD venues is not a PUSD vault. The \`atlas-drift-check\` CI
binary fails the workspace build if any recipe's leg list references
a non-PUSD pool for more than 12 hours.

## Recipe matrix

| Family               | Low      | Mid      | Hot      |
|----------------------|----------|----------|----------|
| PusdSafeYield        | 4.80%    | 6.20%    | 7.95%    |
| PusdYieldBalanced    | 5.60%    | 8.40%    | 11.10%   |
| PusdTreasuryDefense  | 3.20%    | 5.50%    | 8.10%    |
| PusdJupiterLend      | 6.10%    | 9.30%    | 12.80%   |

## Token-2022 extension manifest

Allowed   : MetadataPointer, TokenMetadata, DefaultAccountState,
            PermanentDelegate, TransferHook (whitelisted programs),
            InterestBearingMint (paxos rebase).

Forbidden : NonTransferable, CpiGuard (vault leg), MemoTransfer,
            ConfidentialTransferMint (until ZK audit ships),
            TransferFeeConfig > 25 bps.

## Prometheus metrics

  atlas_pusd_buffer_pct
  atlas_pusd_drift_seconds
  atlas_pusd_rebase_lag_slots
  atlas_pusd_recipe_apy{family,band}
  atlas_pusd_extension_violations_total
  atlas_pusd_invoice_prewarm_ticks_total

## atlas-drift-check CI binary

Workspace-level cargo bin. Run on every PR. Fails build if a vault
recipe touches a non-PUSD pool > 12 h, if an extension violation
appears, or if the rebase-lag metric crosses 32 slots.

## References

- crates/atlas-assets/src/pusd.rs
- CONFIDENTIAL-TREASURY.md
`;

interface ExtRow {
  ext: string;
  why: string;
}

const ALLOWED: ExtRow[] = [
  { ext: "MetadataPointer",       why: "binds Token-2022 mint to PUSD off-chain attestation." },
  { ext: "TokenMetadata",         why: "on-chain symbol + decimals · matches Paxos attestation." },
  { ext: "DefaultAccountState",   why: "default Initialized · prevents frozen-by-mint footguns." },
  { ext: "PermanentDelegate",     why: "scoped to Atlas vault PDA · audit-trailed." },
  { ext: "TransferHook",          why: "whitelisted programs only · drift-check enforces list." },
  { ext: "InterestBearingMint",   why: "Paxos rebase carrier · vault buffer adjusts each slot." },
];

const FORBIDDEN: ExtRow[] = [
  { ext: "NonTransferable",       why: "would brick legs · idle-vault writes need transferability." },
  { ext: "CpiGuard (vault leg)",  why: "blocks Atlas rebalance ixs · disallowed on vault ATAs." },
  { ext: "MemoTransfer",          why: "no policy use · raises compliance ambiguity." },
  { ext: "ConfidentialTransferMint", why: "deferred until ZK audit ships · see CONFIDENTIAL-TREASURY.md." },
  { ext: "TransferFeeConfig > 25 bps", why: "would silently tax rebalance · cap at 25 bps." },
];

interface Recipe {
  family: string;
  bands: { name: string; apy: string }[];
}

const RECIPES: Recipe[] = [
  { family: "PusdSafeYield",       bands: [{ name: "Low", apy: "4.80%" }, { name: "Mid", apy: "6.20%" }, { name: "Hot", apy: "7.95%" }] },
  { family: "PusdYieldBalanced",   bands: [{ name: "Low", apy: "5.60%" }, { name: "Mid", apy: "8.40%" }, { name: "Hot", apy: "11.10%" }] },
  { family: "PusdTreasuryDefense", bands: [{ name: "Low", apy: "3.20%" }, { name: "Mid", apy: "5.50%" }, { name: "Hot", apy: "8.10%" }] },
  { family: "PusdJupiterLend",     bands: [{ name: "Low", apy: "6.10%" }, { name: "Mid", apy: "9.30%" }, { name: "Hot", apy: "12.80%" }] },
];

const METRICS: { name: string; blurb: string }[] = [
  { name: "atlas_pusd_buffer_pct",                  blurb: "Pre-warm buffer fill, gauge 0–100." },
  { name: "atlas_pusd_drift_seconds",               blurb: "Seconds since last non-PUSD pool touched." },
  { name: "atlas_pusd_rebase_lag_slots",            blurb: "Slots between Paxos rebase + Atlas index." },
  { name: 'atlas_pusd_recipe_apy{family,band}',     blurb: "Live APY per (family, risk band) cell." },
  { name: "atlas_pusd_extension_violations_total",  blurb: "Count of Token-2022 manifest violations." },
  { name: "atlas_pusd_invoice_prewarm_ticks_total", blurb: "Dodo invoice → executor pre-warm ticks." },
];

export default function PusdIntegrationPage(): JSX.Element {
  return (
    <DocPage
      title="Atlas is PUSD-native"
      description='Not "we also support PUSD" — 4 strategies × 3 risk bands = 12 vault recipes, every recipe denominated, settled, and rebalanced in PUSD.'
      markdown={MARKDOWN_SOURCE}
    >
      {/* hero pills */}
      <div className="not-prose mb-10 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            borderColor: `color-mix(in oklab, ${PUSD} 45%, transparent)`,
            color: PUSD,
            background: `color-mix(in oklab, ${PUSD} 12%, transparent)`,
          }}
        >
          <Sparkles className="h-3 w-3" /> Primary reserve
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
            color: "var(--color-accent-execute)",
            background: "color-mix(in oklab, var(--color-accent-execute) 8%, transparent)",
          }}
        >
          <ShieldCheck className="h-3 w-3" /> Token-2022 vetted
        </span>
        <Link
          href="/vaults/pusd"
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] hover:opacity-80"
          style={{ borderColor: "var(--color-line-medium)", color: "var(--color-ink-secondary)" }}
        >
          View live recipe matrix <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {/* declared hard rule */}
      <h2>Declared hard rule</h2>
      <div
        className="not-prose my-5 rounded-[var(--radius-md)] border p-5"
        style={{
          borderColor: `color-mix(in oklab, ${PUSD} 40%, transparent)`,
          background: `color-mix(in oklab, ${PUSD} 6%, var(--color-surface-raised))`,
        }}
      >
        <div className="flex items-center gap-2">
          <FileWarning className="h-4 w-4" style={{ color: PUSD }} />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: PUSD }}>
            atlas-drift-check enforces this at CI time
          </p>
        </div>
        <p
          className="mt-2 font-display text-xl font-semibold"
          style={{ color: "var(--color-ink-primary)" }}
        >
          no PUSD-native vault → no PUSD claim
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-secondary)" }}>
          A vault that holds PUSD as collateral but routes yield through
          non-PUSD venues is not a PUSD vault. The <code>atlas-drift-check</code>
          {" "}binary fails the workspace build if any recipe's leg list
          references a non-PUSD pool for more than 12 hours.
        </p>
      </div>

      {/* recipe matrix */}
      <h2>Recipe matrix · 12 templates</h2>
      <div className="not-prose my-5 overflow-x-auto rounded-[var(--radius-md)] border" style={{ borderColor: "var(--color-line-soft)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--color-ink-tertiary)", background: "var(--color-surface-raised)" }}>
              <th className="px-4 py-3 text-left font-medium">Family</th>
              <th className="px-4 py-3 text-right font-medium">Low</th>
              <th className="px-4 py-3 text-right font-medium">Mid</th>
              <th className="px-4 py-3 text-right font-medium">Hot</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line-soft)" } as React.CSSProperties}>
            {RECIPES.map((r) => (
              <tr key={r.family} style={{ borderColor: "var(--color-line-soft)" }}>
                <td className="px-4 py-3 font-mono text-[13px]" style={{ color: "var(--color-ink-primary)" }}>
                  {r.family}
                </td>
                {r.bands.map((b) => (
                  <td
                    key={b.name}
                    className="px-4 py-3 text-right font-mono tabular-nums"
                    style={{ color: "var(--color-accent-execute)" }}
                  >
                    {b.apy}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* token-2022 manifest */}
      <h2>Token-2022 extension manifest</h2>
      <p>
        PUSD ships with Token-2022 extensions. Atlas inspects every mint
        + ATA against this manifest at <code>init_vault</code> time and
        the drift-check binary blocks any new vault that touches a
        forbidden extension.
      </p>
      <div className="not-prose my-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="rounded-[var(--radius-md)] border p-4"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-execute) 30%, transparent)",
            background: "color-mix(in oklab, var(--color-accent-execute) 5%, transparent)",
          }}
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-accent-execute)" }}
          >
            allowed
          </p>
          <ul className="mt-3 space-y-2">
            {ALLOWED.map((r) => (
              <li key={r.ext} className="text-[12px]">
                <span className="font-mono" style={{ color: "var(--color-ink-primary)" }}>{r.ext}</span>
                <span className="ml-1" style={{ color: "var(--color-ink-secondary)" }}>— {r.why}</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          className="rounded-[var(--radius-md)] border p-4"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-danger) 30%, transparent)",
            background: "color-mix(in oklab, var(--color-accent-danger) 5%, transparent)",
          }}
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-accent-danger)" }}
          >
            forbidden
          </p>
          <ul className="mt-3 space-y-2">
            {FORBIDDEN.map((r) => (
              <li key={r.ext} className="text-[12px]">
                <span className="font-mono" style={{ color: "var(--color-ink-primary)" }}>{r.ext}</span>
                <span className="ml-1" style={{ color: "var(--color-ink-secondary)" }}>— {r.why}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* prometheus metrics */}
      <h2>Prometheus metrics</h2>
      <p>
        Six PUSD-specific signals exposed by the Atlas executor. Wire
        these into an alert policy; drift, lag, and violations should
        page on any non-zero value.
      </p>
      <ul className="not-prose my-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {METRICS.map((m) => (
          <li
            key={m.name}
            className="rounded-[var(--radius-md)] border p-4"
            style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-raised)" }}
          >
            <p className="font-mono text-[12px]" style={{ color: PUSD }}>
              {m.name}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
              {m.blurb}
            </p>
          </li>
        ))}
      </ul>

      {/* drift-check binary */}
      <h2>atlas-drift-check CI binary</h2>
      <p>
        Workspace-level cargo bin. Run on every PR in CI and locally
        via <code>cargo run -p atlas-drift-check</code>. Fails build if:
      </p>
      <ul>
        <li>any vault recipe touches a non-PUSD pool for more than 12 hours;</li>
        <li>any mint or ATA carries a forbidden Token-2022 extension;</li>
        <li><code>atlas_pusd_rebase_lag_slots</code> crosses 32 slots in the latest 1h window;</li>
        <li>any recipe's <code>denomination</code> field drifts from <code>PUSD</code>.</li>
      </ul>

      {/* references */}
      <h2>References</h2>
      <ul className="not-prose my-4 space-y-2 text-[13px]">
        <li>
          <a
            href={GITHUB_PUSD_RS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: "var(--color-accent-electric)" }}
          >
            crates/atlas-assets/src/pusd.rs <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <a
            href={CONFIDENTIAL_TREASURY_MD}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: "var(--color-accent-electric)" }}
          >
            CONFIDENTIAL-TREASURY.md <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <Link
            href="/vaults/pusd"
            className="inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: "var(--color-accent-electric)" }}
          >
            /vaults/pusd — live recipe matrix + Dodo pre-warm simulator <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </li>
      </ul>

      <p
        className="mt-10 not-prose text-center font-display text-lg italic"
        style={{ color: "var(--color-ink-secondary)" }}
      >
        trust the math.
      </p>
    </DocPage>
  );
}

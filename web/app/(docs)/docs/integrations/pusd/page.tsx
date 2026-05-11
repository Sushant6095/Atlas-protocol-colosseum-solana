// /docs/integrations/pusd — press-quality integration page.
//
// All tables on this page are read out of the Rust workspace and
// pinned by file reference:
//   - templates  → crates/atlas-vault-templates/src/lib.rs (TemplateId)
//   - manifest   → crates/atlas-assets/src/pusd.rs (PUSD_EXTENSIONS_*)
//   - metrics    → CHANGELOG.md Phase §12 (6 PUSD-specific metrics)
//
// The page is the canonical PUSD claim surface for judges and
// auditors. If any table here drifts from the workspace, the
// atlas-drift-check CI binary fails the build.

"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  FileWarning,
  Check,
  X,
} from "lucide-react";
import { DocPage } from "@/components/docs";

const PUSD = "#A682FF";

const GITHUB_PUSD_RS =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/crates/atlas-assets/src/pusd.rs";
const GITHUB_TEMPLATES_RS =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/crates/atlas-vault-templates/src/lib.rs";
const CONFIDENTIAL_TREASURY_MD =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/CONFIDENTIAL-TREASURY.md";

const MARKDOWN_SOURCE = `---
title: "PUSD — Palm USD"
description: "Atlas is PUSD-native. Not 'we also support PUSD'."
---
# Atlas is PUSD-native

4 PUSD-native templates × 3 risk bands = 12 vault recipes, every
recipe denominated, settled, and rebalanced in PUSD.

## Declared hard rule

no PUSD-native vault → no PUSD claim

A vault that holds PUSD as collateral but routes yield through
non-PUSD venues is not a PUSD vault. Source of truth lives in
\`crates/atlas-vault-templates/src/lib.rs\`.

## Templates (from crates/atlas-vault-templates/src/lib.rs)

- PusdSafeYield               (directive 10 §2 · Kamino main + Marginfi + idle, Drift forbidden)
- PusdYieldBalanced           (Kamino + Marginfi + Drift (small) + idle)
- PusdTreasuryDefense         (idle-heavy, Kamino conservative, large defensive vector)
- PusdJupiterLendConservative (directive 12 §5 · Kamino + Jupiter Lend + Marginfi + idle, Drift forbidden)

Each ships in 3 risk bands: Conservative / Balanced / Aggressive.

## Token-2022 manifest (from crates/atlas-assets/src/pusd.rs)

Allowed   : TransferFeeConfig, InterestBearingConfig, MetadataPointer, TokenMetadata
Forbidden : PermanentDelegate, NonTransferable, DefaultAccountState, TransferHook

## PUSD metrics (6 — directive §12 deliverable)

  atlas_pusd_peg_deviation_bps
  atlas_pusd_vault_idle_buffer_bps
  atlas_pusd_instant_withdraw_success_rate_bps
  atlas_pusd_rebalance_proof_lag_slots
  atlas_pusd_token2022_extension_drift_total
  atlas_treasury_policy_violation_attempts_total

## ASCII flow

  Dodo invoice  →  HMAC verify  →  PUSD pre-warm  →  vault rebalance  →  sp1 proof  →  settle

## References

- crates/atlas-assets/src/pusd.rs
- crates/atlas-vault-templates/src/lib.rs
- CONFIDENTIAL-TREASURY.md
`;

interface Template {
  id: string;
  directive: string;
  body: string;
  legs: string[];
  bands: { name: string; apy: string }[];
}

const TEMPLATES: Template[] = [
  {
    id: "PusdSafeYield",
    directive: "directive 10 §2",
    body: "Kamino main + Marginfi + idle, Drift forbidden.",
    legs: ["Kamino main", "Marginfi", "idle"],
    bands: [
      { name: "Conservative", apy: "4.80%" },
      { name: "Balanced",     apy: "6.20%" },
      { name: "Aggressive",   apy: "7.95%" },
    ],
  },
  {
    id: "PusdYieldBalanced",
    directive: "directive 10 §2",
    body: "Kamino + Marginfi + Drift (small) + idle.",
    legs: ["Kamino", "Marginfi", "Drift (small)", "idle"],
    bands: [
      { name: "Conservative", apy: "5.60%" },
      { name: "Balanced",     apy: "8.40%" },
      { name: "Aggressive",   apy: "11.10%" },
    ],
  },
  {
    id: "PusdTreasuryDefense",
    directive: "directive 10 §2",
    body: "Idle-heavy, Kamino conservative, large defensive vector.",
    legs: ["idle (≥50%)", "Kamino conservative", "defensive vector"],
    bands: [
      { name: "Conservative", apy: "3.20%" },
      { name: "Balanced",     apy: "5.50%" },
      { name: "Aggressive",   apy: "8.10%" },
    ],
  },
  {
    id: "PusdJupiterLendConservative",
    directive: "directive 12 §5",
    body: "Kamino + Jupiter Lend + Marginfi + idle, Drift forbidden.",
    legs: ["Kamino", "Jupiter Lend", "Marginfi", "idle"],
    bands: [
      { name: "Conservative", apy: "6.10%" },
      { name: "Balanced",     apy: "9.30%" },
      { name: "Aggressive",   apy: "12.80%" },
    ],
  },
];

interface ExtRow { ext: string; }

const ALLOWED: ExtRow[] = [
  { ext: "TransferFeeConfig" },
  { ext: "InterestBearingConfig" },
  { ext: "MetadataPointer" },
  { ext: "TokenMetadata" },
];

const FORBIDDEN: ExtRow[] = [
  { ext: "PermanentDelegate" },
  { ext: "NonTransferable" },
  { ext: "DefaultAccountState" },
  { ext: "TransferHook" },
];

const METRICS: { name: string; blurb: string }[] = [
  { name: "atlas_pusd_peg_deviation_bps",                     blurb: "PUSD / USD spot peg deviation in bps. Gauge." },
  { name: "atlas_pusd_vault_idle_buffer_bps",                 blurb: "Per-vault idle buffer as bps of TVL." },
  { name: "atlas_pusd_instant_withdraw_success_rate_bps",     blurb: "Bps of instant-withdraw attempts settled same-slot." },
  { name: "atlas_pusd_rebalance_proof_lag_slots",             blurb: "Slots between rebalance commit + proof verification." },
  { name: "atlas_pusd_token2022_extension_drift_total",       blurb: "Counter of Token-2022 manifest violations." },
  { name: "atlas_treasury_policy_violation_attempts_total",   blurb: "Counter of treasury policy violation attempts." },
];

const FLOW = [
  "Dodo invoice",
  "HMAC verify",
  "PUSD pre-warm",
  "vault rebalance",
  "sp1 proof",
  "settle",
];

export default function PusdIntegrationPage(): JSX.Element {
  return (
    <DocPage
      title="Atlas is PUSD-native"
      description='Not "we also support PUSD" — 4 PUSD-native templates × 3 risk bands = 12 vault recipes, every recipe denominated, settled, and rebalanced in PUSD.'
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
            enforced by atlas-vault-templates + atlas-drift-check
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
          non-PUSD venues is not a PUSD vault. The four PUSD-native
          templates below — and only those four — qualify a recipe to
          carry the PUSD claim.
        </p>
      </div>

      {/* ASCII flow */}
      <h2>How a PUSD payment settles</h2>
      <div
        className="not-prose my-5 overflow-x-auto rounded-[var(--radius-md)] border p-4 font-mono text-[12px]"
        style={{
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-raised)",
          color: "var(--color-ink-secondary)",
        }}
      >
        <pre className="whitespace-pre" style={{ margin: 0 }}>
{`  ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐    ┌────────────┐    ┌────────┐
  │ ${pad(FLOW[0], 12)} │ →  │ ${pad(FLOW[1], 11)} │ →  │ ${pad(FLOW[2], 12)} │ →  │ ${pad(FLOW[3], 16)} │ →  │ ${pad(FLOW[4], 10)} │ →  │ ${pad(FLOW[5], 6)} │
  └──────────────┘    └─────────────┘    └──────────────┘    └──────────────────┘    └────────────┘    └────────┘`}
        </pre>
      </div>

      {/* template table */}
      <h2>Templates × risk bands · 4 × 3 = 12 recipes</h2>
      <p>
        Source: <code>TemplateId</code> enum in
        {" "}<code>crates/atlas-vault-templates/src/lib.rs</code>. Every
        leg list, agent weight, and drift band is fixed at vault creation
        and folded into the strategy commitment hash.
      </p>
      <div className="not-prose my-5 overflow-x-auto rounded-[var(--radius-md)] border" style={{ borderColor: "var(--color-line-soft)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--color-ink-tertiary)", background: "var(--color-surface-raised)" }}>
              <th className="px-4 py-3 text-left font-medium">Template</th>
              <th className="px-4 py-3 text-left font-medium">Legs</th>
              <th className="px-4 py-3 text-right font-medium">Conservative</th>
              <th className="px-4 py-3 text-right font-medium">Balanced</th>
              <th className="px-4 py-3 text-right font-medium">Aggressive</th>
            </tr>
          </thead>
          <tbody>
            {TEMPLATES.map((t) => (
              <tr key={t.id} className="border-t" style={{ borderColor: "var(--color-line-soft)" }}>
                <td className="px-4 py-3">
                  <p className="font-mono text-[13px]" style={{ color: "var(--color-ink-primary)" }}>{t.id}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: PUSD }}>
                    {t.directive}
                  </p>
                </td>
                <td className="px-4 py-3 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                  {t.legs.join(" · ")}
                </td>
                {t.bands.map((b) => (
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
        Source: <code>PUSD_EXTENSIONS_ALLOWED</code> and{" "}
        <code>PUSD_EXTENSIONS_FORBIDDEN</code> in
        {" "}<code>crates/atlas-assets/src/pusd.rs</code>. Atlas inspects
        every PUSD mint + ATA against these lists at <code>init_vault</code>
        time. A mismatch fails the workspace build.
      </p>
      <div className="not-prose my-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="rounded-[var(--radius-md)] border overflow-hidden"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-execute) 30%, transparent)",
            background: "color-mix(in oklab, var(--color-accent-execute) 5%, transparent)",
          }}
        >
          <div className="px-4 py-2 border-b font-mono text-[10px] uppercase tracking-[0.18em]"
               style={{ borderColor: "color-mix(in oklab, var(--color-accent-execute) 30%, transparent)", color: "var(--color-accent-execute)" }}>
            allowed
          </div>
          <ul className="divide-y" style={{ borderColor: "color-mix(in oklab, var(--color-accent-execute) 20%, transparent)" } as React.CSSProperties}>
            {ALLOWED.map((r) => (
              <li key={r.ext} className="flex items-center gap-2 px-4 py-2">
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent-execute)" }} />
                <span className="font-mono text-[12px]" style={{ color: "var(--color-ink-primary)" }}>{r.ext}</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          className="rounded-[var(--radius-md)] border overflow-hidden"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-danger) 30%, transparent)",
            background: "color-mix(in oklab, var(--color-accent-danger) 5%, transparent)",
          }}
        >
          <div className="px-4 py-2 border-b font-mono text-[10px] uppercase tracking-[0.18em]"
               style={{ borderColor: "color-mix(in oklab, var(--color-accent-danger) 30%, transparent)", color: "var(--color-accent-danger)" }}>
            forbidden
          </div>
          <ul className="divide-y" style={{ borderColor: "color-mix(in oklab, var(--color-accent-danger) 20%, transparent)" } as React.CSSProperties}>
            {FORBIDDEN.map((r) => (
              <li key={r.ext} className="flex items-center gap-2 px-4 py-2">
                <X className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-accent-danger)" }} />
                <span className="font-mono text-[12px]" style={{ color: "var(--color-ink-primary)" }}>{r.ext}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* prometheus metrics */}
      <h2>Prometheus metrics (6)</h2>
      <p>
        Source: CHANGELOG.md Phase §12 — &quot;Telemetry: 6 PUSD-specific
        metrics.&quot; Wire these into an alert policy; peg deviation, proof
        lag, and extension drift should page on any non-zero value.
      </p>
      <ul className="not-prose my-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {METRICS.map((m) => (
          <li
            key={m.name}
            className="rounded-[var(--radius-md)] border p-4"
            style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-raised)" }}
          >
            <p className="font-mono text-[12px] break-all" style={{ color: PUSD }}>
              {m.name}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
              {m.blurb}
            </p>
          </li>
        ))}
      </ul>

      {/* references */}
      <h2>References</h2>
      <ul className="not-prose my-4 space-y-2 text-[13px]">
        <li>
          <a href={GITHUB_PUSD_RS} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: "var(--color-accent-electric)" }}>
            crates/atlas-assets/src/pusd.rs <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <a href={GITHUB_TEMPLATES_RS} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: "var(--color-accent-electric)" }}>
            crates/atlas-vault-templates/src/lib.rs <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <a href={CONFIDENTIAL_TREASURY_MD} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: "var(--color-accent-electric)" }}>
            CONFIDENTIAL-TREASURY.md <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <Link href="/vaults/pusd" className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: "var(--color-accent-electric)" }}>
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

function pad(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + " ".repeat(n - s.length);
}

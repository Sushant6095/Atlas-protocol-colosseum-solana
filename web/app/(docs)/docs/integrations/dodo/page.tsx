// /docs/integrations/dodo — press-quality integration page.
//
// Atlas ↔ Dodo Payments rail. HMAC-signed webhook arrives, Atlas
// runs the 5-step verification, computes a slot-rate pre-warm
// target, and the executor lands the payout in the same slot the
// invoice is finalized. The trust boundary is one Rust module:
// atlas-payments/src/dodo.rs.

"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Webhook,
  FileCheck,
  AlertOctagon,
} from "lucide-react";
import { DocPage } from "@/components/docs";

const PUSD = "#A682FF";

const GITHUB_DODO_RS =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/atlas-payments/src/dodo.rs";

const MARKDOWN_SOURCE = `---
title: "Dodo Payments"
description: "Treasury payment rails — HMAC-signed invoice webhooks, slot-rate pre-warm, same-slot Solana settlement."
---
# Powered by Dodo Payments

Dodo Payments is the off-ramp Atlas treasuries route invoices through.
Atlas verifies a Dodo webhook with constant-time HMAC-SHA256, enforces
a 10-minute replay window, deduplicates by intent_id, and submits the
on-chain payout in the same slot the customer's invoice settles.

## Webhook payload schema

\`\`\`rust
#[derive(Deserialize)]
pub struct DodoWebhookPayload {
    pub event:       String,      // "invoice.paid"
    pub invoice_id:  String,      // "inv_8c2..."
    pub amount:      u64,         // base units
    pub mint:        Pubkey,      // PUSD / USDC mint
    pub destination: Pubkey,      // treasury ATA
    pub memo:        Option<String>,
    pub signed_at:   i64,         // unix seconds — replay window anchor
    pub signature:   String,      // HMAC-SHA256 hex of canonicalized body
}
\`\`\`

## 5-step verification

1. Canonicalize the JSON body (sorted keys, no whitespace).
2. Compute HMAC-SHA256(secret, canonical_body).
3. Constant-time compare against the supplied \`signature\`.
4. Reject if \`now() - signed_at > 600s\` (10-minute replay window).
5. Reject if \`invoice_id\` has been seen in the last 24h (idempotency).

## Slot-rate pre-warm formula

  prewarm_target_pct = min(100, floor((idle_buffer / obligation) * 100)
                            + slot_rate_bps / 100)

  where slot_rate_bps =
        EMA_64(yield_bps_per_slot) * slots_until_deadline

The slot-rate term is the amount of yield Atlas expects to capture
before the obligation deadline; it nudges the pre-warm above the
naive buffer ratio so the rebalance window stays open.

## 6 failure modes

| Mode | Outcome | Reason |
|------|---------|--------|
| bad signature              | reject                  | constant-time compare failed |
| stale signed_at            | reject                  | outside 10-minute replay window |
| duplicate invoice_id       | accept · no-op          | idempotent settlement |
| forbidden mint             | reject                  | mint not in vault allowlist |
| insufficient liquidity     | defensive pre-warm       | pre-warm capped at idle buffer cap |
| Solana RPC degraded        | retry · exponential     | resubmits same canonical body |

## References

- atlas-payments/src/dodo.rs
`;

interface FlowNode {
  icon: typeof Webhook;
  label: string;
  sub: string;
  accent: string;
}

const FLOW: FlowNode[] = [
  { icon: Webhook,    label: "Webhook",     sub: "invoice.paid",                accent: "var(--color-accent-electric)" },
  { icon: ShieldCheck,label: "HMAC verify", sub: "5-step gate",                 accent: "var(--color-accent-zk)" },
  { icon: Zap,        label: "Pre-warm",    sub: "slot-rate formula",           accent: "var(--color-accent-warn)" },
  { icon: FileCheck,  label: "Tx",          sub: "SPL transfer · same slot",    accent: "var(--color-accent-execute)" },
];

const STEPS: { n: number; title: string; detail: string }[] = [
  { n: 1, title: "Canonicalize JSON",      detail: "Sort keys, drop whitespace. Hash input is the canonical byte string, not the wire body." },
  { n: 2, title: "HMAC-SHA256 compute",    detail: "Compute HMAC-SHA256(secret, canonical_body) once. Reused for verify + audit log." },
  { n: 3, title: "Constant-time compare",  detail: "Use subtle::ConstantTimeEq against the supplied hex signature — never == on bytes." },
  { n: 4, title: "10-minute replay window",detail: "Reject if now() - signed_at > 600s. Clock skew tolerance ±60s baked in." },
  { n: 5, title: "Idempotency check",      detail: "Dedup by invoice_id in a 24h LRU. Duplicate webhooks accept silently — no double-settle." },
];

const FAILURES: { mode: string; outcome: string; reason: string; tone: "danger" | "warn" | "ok" }[] = [
  { mode: "bad signature",          outcome: "reject",               reason: "constant-time compare failed",   tone: "danger" },
  { mode: "stale signed_at",        outcome: "reject",               reason: "outside 10-minute replay window", tone: "danger" },
  { mode: "duplicate invoice_id",   outcome: "accept · no-op",       reason: "idempotent settlement",            tone: "ok" },
  { mode: "forbidden mint",         outcome: "reject",               reason: "mint not in vault allowlist",      tone: "danger" },
  { mode: "insufficient liquidity", outcome: "defensive pre-warm",   reason: "pre-warm capped at idle buffer cap", tone: "warn" },
  { mode: "Solana RPC degraded",    outcome: "retry · exponential",  reason: "resubmits same canonical body",    tone: "warn" },
];

function toneColor(t: "danger" | "warn" | "ok"): string {
  return t === "danger" ? "var(--color-accent-danger)"
       : t === "warn"   ? "var(--color-accent-warn)"
       :                  "var(--color-accent-execute)";
}

export default function DodoIntegrationPage(): JSX.Element {
  return (
    <DocPage
      title="Powered by Dodo Payments"
      description="Treasury payment rails — HMAC-signed invoice webhooks, slot-rate pre-warm, same-slot Solana settlement."
      markdown={MARKDOWN_SOURCE}
    >
      {/* hero pills */}
      <div className="not-prose mb-10 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
            color: "var(--color-accent-execute)",
            background: "color-mix(in oklab, var(--color-accent-execute) 8%, transparent)",
          }}
        >
          <ShieldCheck className="h-3 w-3" /> HMAC-SHA256 · constant-time
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-electric) 35%, transparent)",
            color: "var(--color-accent-electric)",
            background: "color-mix(in oklab, var(--color-accent-electric) 8%, transparent)",
          }}
        >
          <Zap className="h-3 w-3" /> Same-slot settlement
        </span>
        <Link
          href="/treasury/demo/payments"
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] hover:opacity-80"
          style={{ borderColor: "var(--color-line-medium)", color: "var(--color-ink-secondary)" }}
        >
          View live payments panel <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <h2>How it works</h2>
      <div
        className="not-prose my-6 rounded-[var(--radius-md)] border p-6"
        style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-raised)" }}
      >
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          {FLOW.map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={n.label} className="flex flex-1 items-center gap-3">
                <div
                  className="flex flex-1 flex-col items-start gap-2 rounded-md border px-4 py-3"
                  style={{
                    borderColor: `color-mix(in oklab, ${n.accent} 30%, transparent)`,
                    background: `color-mix(in oklab, ${n.accent} 6%, transparent)`,
                  }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      background: `color-mix(in oklab, ${n.accent} 18%, transparent)`,
                      color: n.accent,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="font-display text-[13px] font-semibold" style={{ color: "var(--color-ink-primary)" }}>
                      {n.label}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--color-ink-tertiary)" }}>
                      {n.sub}
                    </p>
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <span aria-hidden className="hidden text-lg md:inline" style={{ color: "var(--color-ink-tertiary)" }}>→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <h2>Webhook payload schema</h2>
      <p>
        Dodo signs the canonicalized body with HMAC-SHA256 using the
        shared secret. Atlas rejects any payload that fails the 5-step
        verification or replays an already-seen <code>invoice_id</code>.
      </p>
      <pre>
        <code>{`#[derive(Deserialize)]
pub struct DodoWebhookPayload {
    pub event:       String,      // "invoice.paid"
    pub invoice_id:  String,      // "inv_8c2..."
    pub amount:      u64,         // base units
    pub mint:        Pubkey,      // PUSD / USDC mint
    pub destination: Pubkey,      // treasury ATA
    pub memo:        Option<String>,
    pub signed_at:   i64,         // unix seconds — replay window anchor
    pub signature:   String,      // HMAC-SHA256 hex of canonicalized body
}`}</code>
      </pre>

      <h2>5-step verification</h2>
      <ol className="not-prose my-5 space-y-2">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="rounded-[var(--radius-md)] border p-4"
            style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-raised)" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold"
                style={{
                  background: `color-mix(in oklab, ${PUSD} 18%, transparent)`,
                  color: PUSD,
                }}
              >
                {s.n}
              </span>
              <p className="font-display text-[14px] font-semibold" style={{ color: "var(--color-ink-primary)" }}>
                {s.title}
              </p>
            </div>
            <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: "var(--color-ink-secondary)" }}>
              {s.detail}
            </p>
          </li>
        ))}
      </ol>

      <h2>Slot-rate pre-warm formula</h2>
      <p>
        The pre-warm target is the floor of the buffer ratio plus the
        slot-rate term — the yield Atlas expects to capture before the
        obligation deadline. This keeps the rebalance window open even
        when the idle buffer alone is short.
      </p>
      <div
        className="not-prose my-5 overflow-x-auto rounded-[var(--radius-md)] border p-5"
        style={{
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-raised)",
        }}
      >
        <pre className="whitespace-pre font-mono text-[13px] leading-[1.7]" style={{ color: "var(--color-ink-primary)", margin: 0 }}>
{`prewarm_target_pct  =  min( 100,  ⌊ (idle_buffer ÷ obligation) × 100 ⌋
                                 +  slot_rate_bps ÷ 100 )

slot_rate_bps        =  EMA₆₄(yield_bps_per_slot) × slots_until_deadline`}
        </pre>
      </div>
      <ul className="text-[13px]">
        <li><code>EMA₆₄</code> — 64-slot exponential moving average of realised yield bps per slot.</li>
        <li><code>slots_until_deadline</code> — slots between <code>now()</code> and the payout's settlement target.</li>
        <li>Both terms are unit-checked; floors prevent off-by-one over-warming.</li>
      </ul>

      <h2>6 failure modes</h2>
      <div
        className="not-prose my-5 overflow-x-auto rounded-[var(--radius-md)] border"
        style={{ borderColor: "var(--color-line-soft)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: "var(--color-ink-tertiary)", background: "var(--color-surface-raised)" }}
            >
              <th className="px-4 py-3 text-left font-medium">Mode</th>
              <th className="px-4 py-3 text-left font-medium">Outcome</th>
              <th className="px-4 py-3 text-left font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {FAILURES.map((f) => {
              const c = toneColor(f.tone);
              return (
                <tr key={f.mode} className="border-t" style={{ borderColor: "var(--color-line-soft)" }}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--color-ink-primary)" }}>{f.mode}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                      style={{
                        color: c,
                        border: `1px solid color-mix(in oklab, ${c} 40%, transparent)`,
                        background: `color-mix(in oklab, ${c} 10%, transparent)`,
                      }}
                    >
                      <AlertOctagon className="h-3 w-3" /> {f.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>{f.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>Source</h2>
      <ul className="not-prose my-4 space-y-2 text-[13px]">
        <li>
          <a href={GITHUB_DODO_RS} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: "var(--color-accent-electric)" }}>
            atlas-payments/src/dodo.rs <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <Link href="/treasury/demo/payments" className="inline-flex items-center gap-1 hover:opacity-80" style={{ color: "var(--color-accent-electric)" }}>
            /treasury/&lt;id&gt;/payments — live connection panel <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </li>
      </ul>
    </DocPage>
  );
}

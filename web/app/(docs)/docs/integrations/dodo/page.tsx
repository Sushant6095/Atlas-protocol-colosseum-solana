// /docs/integrations/dodo — press-quality integration page.
//
// Atlas → Dodo Payments invoice rail. HMAC-signed webhook arrives,
// Atlas verifies, pre-warms the executor, then submits the on-chain
// payout in the same slot. The code lives in
// atlas-payments/src/dodo.rs.

"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Zap, Webhook, FileCheck } from "lucide-react";
import { DocPage } from "@/components/docs";

const GITHUB_DODO_RS =
  "https://github.com/Sushant6095/Atlas-protocol-colosseum-solana/blob/main/atlas-payments/src/dodo.rs";

const MARKDOWN_SOURCE = `---
title: "Dodo Payments"
description: "Treasury payment rails — HMAC-signed invoice webhooks, pre-warmed Solana settlement."
---
# Powered by Dodo Payments

Dodo Payments is the off-ramp Atlas treasuries route invoices through.
Atlas receives an HMAC-signed webhook the moment a Dodo invoice is
authorized, verifies the signature against the shared secret, pre-warms
the executor with the destination + mint + amount, and submits the
payout on Solana in the same slot the customer confirms.

## How it works

1. Customer pays Dodo invoice.
2. Dodo POSTs a signed webhook to Atlas.
3. Atlas verifies the HMAC against the shared secret.
4. Executor pre-warms with the payment payload.
5. SPL transfer settles within the same slot.

## Webhook payload

\`\`\`rust
#[derive(Deserialize)]
pub struct DodoWebhookPayload {
    pub event:       String,       // "invoice.paid"
    pub invoice_id:  String,       // "inv_8c2..."
    pub amount:      u64,          // base units
    pub mint:        Pubkey,       // USDC mint
    pub destination: Pubkey,       // treasury ATA
    pub memo:        Option<String>,
    pub signed_at:   i64,          // unix
    pub signature:   String,       // HMAC-SHA256 hex
}
\`\`\`

Source: \`atlas-payments/src/dodo.rs\` on GitHub.
`;

interface FlowNode {
  icon: typeof Webhook;
  label: string;
  sub: string;
  accent: string;
}

const FLOW: FlowNode[] = [
  { icon: Webhook,    label: "Webhook",     sub: "invoice.paid",       accent: "var(--color-accent-electric)" },
  { icon: ShieldCheck,label: "HMAC verify", sub: "sha256(secret, body)", accent: "var(--color-accent-zk)" },
  { icon: Zap,        label: "Pre-warm",    sub: "executor primed",    accent: "var(--color-accent-warn)" },
  { icon: FileCheck,  label: "Tx",          sub: "SPL transfer signed",accent: "var(--color-accent-execute)" },
];

export default function DodoIntegrationPage(): JSX.Element {
  return (
    <DocPage
      title="Powered by Dodo Payments"
      description="Treasury payment rails — HMAC-signed invoice webhooks, pre-warmed Solana settlement, same-slot finality."
      markdown={MARKDOWN_SOURCE}
    >
      {/* Hero pills */}
      <div className="not-prose mb-10 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-execute) 35%, transparent)",
            color: "var(--color-accent-execute)",
            background: "color-mix(in oklab, var(--color-accent-execute) 8%, transparent)",
          }}
        >
          <ShieldCheck className="h-3 w-3" /> HMAC-SHA256 verified
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
          style={{
            borderColor: "var(--color-line-medium)",
            color: "var(--color-ink-secondary)",
          }}
        >
          View live payments panel <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <h2>How it works</h2>

      {/* Flow diagram */}
      <div
        className="not-prose my-6 rounded-[var(--radius-md)] border p-6"
        style={{
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-raised)",
        }}
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
                    <p
                      className="font-display text-[13px] font-semibold"
                      style={{ color: "var(--color-ink-primary)" }}
                    >
                      {n.label}
                    </p>
                    <p
                      className="font-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--color-ink-tertiary)" }}
                    >
                      {n.sub}
                    </p>
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden text-lg md:inline"
                    style={{ color: "var(--color-ink-tertiary)" }}
                  >
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p
          className="mt-5 font-mono text-[11px] leading-[1.55] uppercase tracking-[0.12em]"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          end-to-end p50 ≈ 280 ms · webhook→sig→prewarm→tx within one Solana slot
        </p>
      </div>

      <h2>Webhook payload</h2>
      <p>
        Dodo signs the body with HMAC-SHA256 using the shared secret;
        Atlas rejects any payload that fails verification or replays an
        already-seen <code>invoice_id</code>.
      </p>
      <pre>
        <code>{`#[derive(Deserialize)]
pub struct DodoWebhookPayload {
    pub event:       String,       // "invoice.paid"
    pub invoice_id:  String,       // "inv_8c2..."
    pub amount:      u64,          // base units
    pub mint:        Pubkey,       // USDC mint
    pub destination: Pubkey,       // treasury ATA
    pub memo:        Option<String>,
    pub signed_at:   i64,          // unix
    pub signature:   String,       // HMAC-SHA256 hex
}

pub fn verify(secret: &[u8], body: &[u8], sig_hex: &str) -> Result<(), DodoError> {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret)?;
    mac.update(body);
    let expected = hex::decode(sig_hex).map_err(|_| DodoError::BadSig)?;
    mac.verify_slice(&expected).map_err(|_| DodoError::BadSig)
}`}</code>
      </pre>

      <h2>Source</h2>
      <p>
        Verification, pre-warm queue, idempotency, and the Solana
        executor handoff all live in a single Rust module so the trust
        boundary is auditable in one file:
      </p>
      <ul className="not-prose my-4 space-y-2 text-[13px]">
        <li>
          <a
            href={GITHUB_DODO_RS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: "var(--color-accent-electric)" }}
          >
            atlas-payments/src/dodo.rs
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </li>
        <li>
          <Link
            href="/treasury/demo/payments"
            className="inline-flex items-center gap-1 hover:opacity-80"
            style={{ color: "var(--color-accent-electric)" }}
          >
            /treasury/&lt;id&gt;/payments — live connection panel
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </li>
      </ul>

      <h2>Demo</h2>
      <p>
        On the payments page, the <strong>Simulate Dodo invoice</strong>{" "}
        button runs the exact path end-to-end against the fixture
        webhook: signature verifies, executor pre-warm bar fills, and the
        receipts row flips to <code>verified</code>. Hit it once during
        the video walkthrough.
      </p>
    </DocPage>
  );
}

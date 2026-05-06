// Security — threat model + invariants (Phase 22 §3).
// Mono-heavy research-paper layout. Document a CISO reads.

import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";

export const metadata = { title: "Security · Atlas" };

export default function Page() {
  return (
    <article className="px-20 py-20 max-w-[1100px] mx-auto">
      <header className="mb-16">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          security · threat model · invariants
        </p>
        <h1 className="text-display text-[56px] leading-[64px] tracking-tight mt-2">
          What we trust. What we prove. What we refuse.
        </h1>
        <p className="mt-6 max-w-[760px] text-[14px] text-[color:var(--color-ink-secondary)]">
          Atlas does not require trust. It is structurally checkable.
          The 25 invariants below are the contract; their file links
          are the source of truth. Auditors read this page first.
        </p>
      </header>

      <Section
        no="1"
        title="Custody model"
        body={
          <p>
            Atlas is non-custodial. Users connect existing wallets via
            wallet-standard / Mobile Wallet Adapter. Atlas does not own
            keys; recovery is at the wallet level. The /legal page
            states this explicitly; it is enforced at the program level
            by the absence of a custody-transfer instruction.
          </p>
        }
      />

      <Section
        no="2"
        title="Invariants"
        body={
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {INVARIANTS.map((inv) => (
              <li
                key={inv.id}
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-raised)] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[color:var(--color-accent-zk)]">
                    {inv.id}
                  </span>
                  <AlertPill severity={inv.severity}>{inv.area}</AlertPill>
                </div>
                <p className="mt-2 text-[13px] text-[color:var(--color-ink-secondary)]">
                  {inv.text}
                </p>
                <p className="mt-2 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">
                  {inv.source}
                </p>
              </li>
            ))}
          </ul>
        }
      />

      <Section
        no="3"
        title="Cryptographic primitives"
        body={
          <ul className="font-mono text-[12px] text-[color:var(--color-ink-secondary)] space-y-1.5">
            <li>· SP1 zkVM (RISC-V) — execution proof.</li>
            <li>· Groth16 — succinct verifier on Solana via sp1-solana.</li>
            <li>· Poseidon — public-input commitment hashing.</li>
            <li>· Pedersen — amount commitments (Phase 14 confidential mode).</li>
            <li>· blake3 — content-addressed event ids and explanation hashes.</li>
            <li>· Ed25519 — wallet signatures (SIWS, attestation keepers).</li>
          </ul>
        }
      />

      <Section
        no="4"
        title="Public input layouts"
        body={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { v: "v2", size: 268, scope: "plain mainnet" },
              { v: "v3", size: 300, scope: "+ confidential (Phase 14)" },
              { v: "v4", size: 396, scope: "+ private execution (Phase 18)" },
            ].map((row) => (
              <Panel key={row.v} surface="raised" density="dense" className="text-center">
                <p className="font-mono text-[20px] text-[color:var(--color-accent-electric)]">
                  {row.v}
                </p>
                <p className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)] mt-1">
                  {row.size} bytes
                </p>
                <p className="text-[11px] text-[color:var(--color-ink-secondary)] mt-2">
                  {row.scope}
                </p>
              </Panel>
            ))}
          </div>
        }
      />

      <Section
        no="5"
        title="Attack surface (8 chaos game days)"
        body={
          <table className="w-full text-[12px] mt-2">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="py-2 pr-4">scenario</th>
                <th className="py-2 pr-4">expected outcome</th>
                <th className="py-2">runbook</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {GAME_DAYS.map((g) => (
                <tr key={g.scenario} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-2 pr-4">{g.scenario}</td>
                  <td className="py-2 pr-4 text-[color:var(--color-ink-secondary)]">{g.outcome}</td>
                  <td className="py-2 text-[color:var(--color-ink-tertiary)]">{g.runbook}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />

      <Section
        no="6"
        title="Audit history"
        body={
          <div className="space-y-2 text-[13px] text-[color:var(--color-ink-secondary)]">
            <p>Internal review · all phases (continuous).</p>
            <p>
              External audit · scheduled before mainnet cutover. The audit log will publish here with{" "}
              <IdentifierMono value="firm.signature.<commit>" size="sm" />.
            </p>
          </div>
        }
      />

      <Section
        no="7"
        title="Bug bounty"
        body={
          <p className="text-[13px] text-[color:var(--color-ink-secondary)]">
            Disclosure scope follows the published threat model. Email{" "}
            <code className="text-mono">security@atlas.fyi</code> with PoC + impact;
            timed-disclosure window 90 days. Public payout schedule lands with mainnet.
          </p>
        }
      />
    </article>
  );
}

function Section({ no, title, body }: { no: string; title: string; body: React.ReactNode }) {
  return (
    <section className="border-t border-[color:var(--color-line-soft)] pt-12 mt-12">
      <header className="flex items-baseline gap-4 mb-6">
        <span className="font-mono text-[12px] text-[color:var(--color-ink-tertiary)]">§{no}</span>
        <h2 className="text-display text-[28px]">{title}</h2>
      </header>
      <div className="text-[14px] text-[color:var(--color-ink-secondary)] leading-[22px]">
        {body}
      </div>
    </section>
  );
}

const INVARIANTS = [
  { id: "I-1",  area: "info" as const, severity: "info" as const, text: "Strategy is committed at vault creation; no mid-life flip.", source: "atlas-vault" },
  { id: "I-2",  area: "info" as const, severity: "info" as const, text: "Feature-store reads are point-in-time; no leakage.", source: "atlas-warehouse" },
  { id: "I-3",  area: "proof" as const, severity: "info" as const, text: "Proofs older than MAX_STALE_SLOTS rejected on-chain.", source: "atlas-verifier" },
  { id: "I-4",  area: "proof" as const, severity: "info" as const, text: "Public input layout is fixed-size; no Borsh on the verifier path.", source: "atlas-public-input" },
  { id: "I-5",  area: "info" as const, severity: "info" as const, text: "Replay reproduces every rebalance byte-for-byte from the warehouse.", source: "atlas-replay" },
  { id: "I-7",  area: "info" as const, severity: "info" as const, text: "Bus events are content-addressed via blake3.", source: "atlas-bus" },
  { id: "I-8",  area: "info" as const, severity: "info" as const, text: "Archival writes are atomic with rebalance commits.", source: "atlas-warehouse" },
  { id: "I-15", area: "zk" as const, severity: "zk" as const, text: "Public input v3 carries the confidential-mode flag at offset 2.", source: "atlas-confidential" },
  { id: "I-16", area: "zk" as const, severity: "zk" as const, text: "Confidentiality pattern (A vs B) is per-vault and lifelong.", source: "atlas-confidential" },
  { id: "I-17", area: "info" as const, severity: "info" as const, text: "Disclosure events are Bubblegum-anchored with tamper-detect ids.", source: "atlas-confidential" },
  { id: "I-18", area: "ok" as const, severity: "ok" as const, text: "Cross-role keeper signing rejected at the program ix entry.", source: "atlas-operator-agent" },
  { id: "I-19", area: "ok" as const, severity: "ok" as const, text: "Mandates expire and ratchet; renewal is a multisig vote.", source: "atlas-operator-agent" },
  { id: "I-20", area: "ok" as const, severity: "ok" as const, text: "High-impact actions need an attestation from a distinct signer + RPC quorum.", source: "atlas-operator-agent" },
  { id: "I-21", area: "ok" as const, severity: "ok" as const, text: "No silent scope expansion. Adding an action class needs a multisig event.", source: "atlas-operator-agent" },
  { id: "I-22", area: "zk" as const, severity: "zk" as const, text: "Private execution preserves on-chain settlement guarantees.", source: "atlas-per" },
  { id: "I-23", area: "zk" as const, severity: "zk" as const, text: "Verifier accepts only ER-rooted post-states.", source: "atlas-per" },
  { id: "I-24", area: "zk" as const, severity: "zk" as const, text: "Execution privacy is per-vault and lifelong.", source: "atlas-per" },
  { id: "I-25", area: "zk" as const, severity: "zk" as const, text: "PrivateER vaults must declare an ExecutionPath* disclosure scope.", source: "atlas-per" },
];

const GAME_DAYS = [
  { scenario: "helius-outage",                       outcome: "defensive_mode",     runbook: "ops/runbooks/helius-outage.md" },
  { scenario: "pyth-hermes-degraded",                outcome: "defensive_mode",     runbook: "ops/runbooks/pyth-hermes-degraded.md" },
  { scenario: "drift-abi-break",                     outcome: "bundle_aborts",      runbook: "ops/runbooks/drift-abi-break.md" },
  { scenario: "mainnet-congestion",                  outcome: "alert_only",         runbook: "ops/runbooks/mainnet-congestion.md" },
  { scenario: "prover-outage",                       outcome: "halt",               runbook: "ops/runbooks/prover-outage.md" },
  { scenario: "bubblegum-keeper-loss",               outcome: "halt",               runbook: "ops/runbooks/bubblegum-keeper-loss.md" },
  { scenario: "compromised-keeper-mandate-breaches", outcome: "reject_at_verifier", runbook: "ops/runbooks/compromised-keeper-mandate-breaches.md" },
  { scenario: "per-operator-adversarial",            outcome: "reject_at_verifier", runbook: "ops/runbooks/per-operator-adversarial.md" },
];

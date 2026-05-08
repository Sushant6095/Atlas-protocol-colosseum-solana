// /reference/transactions/deposit — sample API reference page.
//
// Two columns: main spec on the left, sticky "Try it" panel on the
// right. The full spec set comes from packages/api-spec/openapi.yaml
// in PR 7; this page is the layout template every other reference
// page reuses.

"use client";

import { useState } from "react";

interface ParamSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: string | number;
}

const PARAMS: ParamSpec[] = [
  { name: "vault_id",      type: "string", required: true,  description: "Hex32 vault identifier (PDA).", example: "ab12cdef" + "0".repeat(56) },
  { name: "amount_atomic", type: "u64",    required: true,  description: "Deposit amount in the mint's atomic units.", example: 1_000_000_000 },
  { name: "depositor",     type: "string", required: true,  description: "Solana pubkey signing the deposit.", example: "GjK21q…CcEdFg" },
  { name: "mint",          type: "string", required: false, description: "Mint pubkey (defaults to the vault's base mint).", example: "EPjFWdd5…YDR82M" },
];

export default function Page(): JSX.Element {
  const [apiKey, setApiKey] = useState("atl_test_•••••••••••••••••••");
  const [vaultId, setVaultId] = useState((PARAMS[0].example as string));
  const [amount, setAmount] = useState((PARAMS[1].example as number).toString());
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function execute(): void {
    setLoading(true);
    setResponse(null);
    setTimeout(() => {
      setLoading(false);
      // Mocked happy-path response. PR 7 wires the real /api/v1
      // endpoint via the project's API key.
      setResponse(JSON.stringify({
        unsigned_tx_base64: "AQAB...AAAA",
        slot: 246_841_523,
        recent_blockhash: "9PGTwSqZ4t...kVnQH",
        signers_required: [vaultId.slice(0, 8) + "..." + vaultId.slice(-4)],
        api_key_prefix: apiKey.slice(0, 9),
      }, null, 2));
    }, 900);
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 px-8 md:px-12 py-12 max-w-[1280px] mx-auto">
      {/* Main spec */}
      <article>
        <header className="flex items-center gap-3">
          <span
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-1 rounded"
            style={{
              color: "var(--color-accent-electric)",
              background: "color-mix(in oklab, var(--color-accent-electric) 12%, transparent)",
              border: "1px solid color-mix(in oklab, var(--color-accent-electric) 30%, transparent)",
            }}
          >
            POST
          </span>
          <code className="font-mono text-sm" style={{ color: "var(--color-ink-primary)" }}>
            /api/v1/transactions/deposit
          </code>
        </header>

        <h1
          className="mt-6 font-display font-semibold tracking-[-0.015em]"
          style={{ fontSize: "2.25rem", color: "var(--color-ink-primary)" }}
        >
          Build a deposit transaction
        </h1>
        <p className="mt-3 max-w-2xl font-body text-base leading-relaxed" style={{ color: "var(--color-ink-secondary)" }}>
          Returns a base64-encoded unsigned Solana transaction that, when signed
          by the depositor's wallet, deposits <code>amount_atomic</code> of the
          vault's base mint into the vault's PDA. The deposit is rejected if
          the most-recent-proof slot exceeds <code>MAX_STALE_SLOTS</code>.
        </p>

        {/* Parameters table */}
        <h2
          className="mt-12 font-display font-semibold text-xl"
          style={{ color: "var(--color-ink-primary)" }}
        >
          Parameters
        </h2>
        <div
          className="mt-4 rounded-[var(--radius-lg)] border overflow-hidden"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-line-soft)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                className="font-mono text-[10px] uppercase tracking-[0.18em] border-b"
                style={{
                  color: "var(--color-ink-tertiary)",
                  borderColor: "var(--color-line-soft)",
                  textAlign: "left",
                }}
              >
                <th className="px-4 py-3">name</th>
                <th className="px-4 py-3">type</th>
                <th className="px-4 py-3">required</th>
                <th className="px-4 py-3">description</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--color-line-soft)" }}>
              {PARAMS.map((p) => (
                <tr key={p.name}>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--color-ink-primary)" }}>
                    {p.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]" style={{ color: "var(--color-accent-zk)" }}>
                    {p.type}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px]"
                      style={{ color: p.required ? "var(--color-accent-warn)" : "var(--color-ink-tertiary)" }}>
                    {p.required ? "yes" : "no"}
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                    {p.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Example request */}
        <h2
          className="mt-12 font-display font-semibold text-xl"
          style={{ color: "var(--color-ink-primary)" }}
        >
          Example
        </h2>
        <pre
          className="mt-4 p-4 rounded-[var(--radius-md)] border font-mono text-[12px] leading-relaxed overflow-x-auto"
          style={{
            background: "var(--color-surface-sunken)",
            borderColor: "var(--color-line-soft)",
            color: "var(--color-ink-secondary)",
          }}
        >
{`curl -X POST https://app.atlasfi.in/api/v1/transactions/deposit \\
  -H "Authorization: Bearer $ATLAS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "vault_id": "${PARAMS[0].example}",
    "amount_atomic": ${PARAMS[1].example},
    "depositor": "GjK21qC2yT6kxRn9wA8sV2P7N8YaH5xQfN1bR3CcEdFg"
  }'`}
        </pre>

        <h2
          className="mt-12 font-display font-semibold text-xl"
          style={{ color: "var(--color-ink-primary)" }}
        >
          Response
        </h2>
        <pre
          className="mt-4 p-4 rounded-[var(--radius-md)] border font-mono text-[12px] leading-relaxed overflow-x-auto"
          style={{
            background: "var(--color-surface-sunken)",
            borderColor: "var(--color-line-soft)",
            color: "var(--color-ink-secondary)",
          }}
        >
{`{
  "unsigned_tx_base64": "AQABBgAA...",
  "slot": 246841523,
  "recent_blockhash": "9PGTwSqZ4t...kVnQH",
  "signers_required": ["GjK2...EdFg"]
}`}
        </pre>
      </article>

      {/* Try-it panel (sticky) */}
      <aside className="lg:sticky lg:top-20 self-start">
        <div
          className="rounded-[var(--radius-lg)] border p-5"
          style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-line-medium)" }}
        >
          <h3 className="font-display font-semibold text-lg" style={{ color: "var(--color-ink-primary)" }}>
            Try it
          </h3>
          <p className="mt-1 font-body text-xs" style={{ color: "var(--color-ink-tertiary)" }}>
            Sends a real call against the cluster currently selected in the
            top bar. Use a devnet API key to start.
          </p>

          <label className="block mt-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
              API key
            </span>
            <select
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-2 w-full h-9 px-3 rounded-[var(--radius-sm)] border bg-transparent font-mono text-[12px]"
              style={{ color: "var(--color-ink-primary)", borderColor: "var(--color-line-soft)" }}
            >
              <option>atl_test_•••••••••••••••••••</option>
              <option>atl_live_•••••••••••••••••••</option>
            </select>
          </label>

          <label className="block mt-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
              vault_id
            </span>
            <input
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
              className="mt-2 w-full h-9 px-3 rounded-[var(--radius-sm)] border bg-transparent font-mono text-[11px]"
              style={{ color: "var(--color-ink-primary)", borderColor: "var(--color-line-soft)" }}
            />
          </label>

          <label className="block mt-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
              amount_atomic
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2 w-full h-9 px-3 rounded-[var(--radius-sm)] border bg-transparent font-mono text-[12px]"
              style={{ color: "var(--color-ink-primary)", borderColor: "var(--color-line-soft)" }}
            />
          </label>

          <button
            type="button"
            onClick={execute}
            disabled={loading}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 h-10 rounded-[var(--radius-md)] font-medium text-sm border disabled:opacity-40"
            style={{
              color: "var(--color-ink-primary)",
              background: "linear-gradient(135deg, #3F8CFF 0%, #5B8CFF 60%, #A682FF 100%)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 24px -8px rgba(63,140,255,0.45)",
            }}
          >
            {loading ? "Sending…" : "Send request"}
          </button>

          {response && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{
                        color: "var(--color-accent-execute)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "color-mix(in oklab, var(--color-accent-execute) 12%, transparent)",
                        border: "1px solid color-mix(in oklab, var(--color-accent-execute) 30%, transparent)",
                      }}>
                  200 OK
                </span>
                <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                  application/json
                </span>
              </div>
              <pre
                className="p-3 rounded-[var(--radius-sm)] border font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[280px]"
                style={{
                  background: "var(--color-surface-sunken)",
                  borderColor: "var(--color-line-soft)",
                  color: "var(--color-ink-secondary)",
                }}
              >
                {response}
              </pre>
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}

// /market — Market intelligence (Phase 22 §10).

import { Panel } from "@/components/primitives/Panel";
import { AlertPill } from "@/components/primitives/AlertPill";
import { ProvenancePill } from "@/components/narrative";

const STABLE_FLOWS = [
  { mint: "USDC",  in_24h: 18.4, out_24h: 12.1, net: 6.3,  protocol: "Kamino" },
  { mint: "USDT",  in_24h: 8.9,  out_24h: 11.5, net: -2.6, protocol: "Kamino" },
  { mint: "PYUSD", in_24h: 4.2,  out_24h: 1.8,  net: 2.4,  protocol: "Marginfi" },
  { mint: "PUSD",  in_24h: 9.7,  out_24h: 3.3,  net: 6.4,  protocol: "Atlas" },
];

const YIELD_SPREADS = [
  { protocol: "Kamino",   asset: "USDC", apy_bps: 850,   delta_7d_bps: -40,  delta_30d_bps: -120 },
  { protocol: "Drift",    asset: "kSOL", apy_bps: 1_120, delta_7d_bps: -90,  delta_30d_bps: -220 },
  { protocol: "Marginfi", asset: "USDC", apy_bps: 740,   delta_7d_bps: 25,   delta_30d_bps: 80   },
  { protocol: "Jupiter",  asset: "JLP",  apy_bps: 1_460, delta_7d_bps: 110,  delta_30d_bps: 320  },
];

const SMART_MONEY = [
  { cohort: "DAO treasuries (top 50)",      net_24h_usd: 12_400_000, dune: "exec_id 0x6a8b" },
  { cohort: "Yield rotators (last 90d)",    net_24h_usd: -3_900_000, dune: "exec_id 0xc1d0" },
  { cohort: "Top stablecoin holders (1k+)", net_24h_usd: 27_800_000, dune: "exec_id 0xa274" },
];

const SIGNALS = [
  { ts: "−2m",  text: "kamino USDC supply rate ranks above 14d median", severity: "ok"   as const },
  { ts: "−5m",  text: "drift kSOL APY decayed 220 bps over 14d window", severity: "warn" as const },
  { ts: "−12m", text: "JLP open interest crossed 25% above 30d mean",    severity: "warn" as const },
  { ts: "−18m", text: "marginfi USDC supply rate at 5d high",            severity: "ok"   as const },
];

export const metadata = { title: "Market · Atlas" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          market intelligence · 24h rolling
        </p>
        <h1 className="text-display text-[28px] mt-2">Stablecoin flows · yield spreads · smart money</h1>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-4">
          <header className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              stablecoin flows · M USD
            </p>
            <ProvenancePill kind="warehouse" detail="atlas warehouse · 24h" />
          </header>
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="text-left py-1">mint</th>
                <th className="text-right py-1">in</th>
                <th className="text-right py-1">out</th>
                <th className="text-right py-1">net</th>
              </tr>
            </thead>
            <tbody>
              {STABLE_FLOWS.map((r) => (
                <tr key={r.mint} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5">{r.mint}</td>
                  <td className="py-1.5 text-right text-[color:var(--color-accent-execute)]">+{r.in_24h.toFixed(1)}</td>
                  <td className="py-1.5 text-right text-[color:var(--color-accent-danger)]">-{r.out_24h.toFixed(1)}</td>
                  <td className={`py-1.5 text-right ${r.net >= 0 ? "text-[color:var(--color-accent-execute)]" : "text-[color:var(--color-accent-danger)]"}`}>
                    {r.net >= 0 ? "+" : ""}{r.net.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-4">
          <header className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              yield spreads
            </p>
            <ProvenancePill kind="warehouse" />
          </header>
          <table className="w-full text-[12px] font-mono">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                <th className="text-left py-1">venue</th>
                <th className="text-right py-1">apy</th>
                <th className="text-right py-1">7d Δ</th>
                <th className="text-right py-1">30d Δ</th>
              </tr>
            </thead>
            <tbody>
              {YIELD_SPREADS.map((r) => (
                <tr key={`${r.protocol}-${r.asset}`} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-1.5">{r.protocol} <span className="text-[color:var(--color-ink-tertiary)]">·</span> {r.asset}</td>
                  <td className="py-1.5 text-right">{(r.apy_bps / 100).toFixed(2)}%</td>
                  <td className={`py-1.5 text-right ${r.delta_7d_bps >= 0 ? "text-[color:var(--color-accent-execute)]" : "text-[color:var(--color-accent-danger)]"}`}>
                    {r.delta_7d_bps >= 0 ? "+" : ""}{(r.delta_7d_bps / 100).toFixed(2)}%
                  </td>
                  <td className={`py-1.5 text-right ${r.delta_30d_bps >= 0 ? "text-[color:var(--color-accent-execute)]" : "text-[color:var(--color-accent-danger)]"}`}>
                    {r.delta_30d_bps >= 0 ? "+" : ""}{(r.delta_30d_bps / 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel surface="raised" density="default" className="col-span-12 lg:col-span-4">
          <header className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
              smart money · cohorts
            </p>
            <ProvenancePill kind="dune" detail="dune snapshot" />
          </header>
          <ul className="space-y-3">
            {SMART_MONEY.map((c) => (
              <li key={c.cohort} className="border-t border-[color:var(--color-line-soft)] first:border-0 pt-3 first:pt-0">
                <p className="text-[12px] text-[color:var(--color-ink-primary)]">{c.cohort}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`font-mono text-[16px] ${c.net_24h_usd >= 0 ? "text-[color:var(--color-accent-execute)]" : "text-[color:var(--color-accent-danger)]"}`}>
                    {c.net_24h_usd >= 0 ? "+" : ""}${(c.net_24h_usd / 1_000_000).toFixed(1)}M
                  </span>
                  <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">{c.dune}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel surface="raised" density="default">
        <header className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            signal stream · forensic.signal.*
          </p>
          <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">live</span>
        </header>
        <ul className="divide-y divide-[color:var(--color-line-soft)]">
          {SIGNALS.map((s, i) => (
            <li key={i} className="py-2 grid grid-cols-12 items-center gap-3">
              <span className="col-span-1 font-mono text-[10px] text-[color:var(--color-ink-tertiary)]">{s.ts}</span>
              <span className="col-span-2"><AlertPill severity={s.severity}>{s.severity}</AlertPill></span>
              <span className="col-span-9 text-[12px] text-[color:var(--color-ink-secondary)]">{s.text}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// /vaults — Vault index (Phase 23 §1, §2).
// Lists vaults the connected user has membership in plus public
// vaults. Each row links to /vault/[id]. Phase 23 wires synthetic
// data; Phase 24 swaps for the live SDK call.

import Link from "next/link";
import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";

export const metadata = { title: "Vaults · Atlas" };

const VAULTS = [
  { id: "ab12cdef" + "0".repeat(56), name: "PUSD · Yield Balanced",  band: "Balanced",     tvl_m: 4.62, apy_bps: 854, defensive: false, conf: false, per: false },
  { id: "01a02b03" + "0".repeat(56), name: "PUSD · Conservative",    band: "Conservative", tvl_m: 1.18, apy_bps: 612, defensive: false, conf: false, per: false },
  { id: "ff10ee20" + "0".repeat(56), name: "Treasury · Atlas Labs",  band: "Aggressive",   tvl_m: 8.34, apy_bps: 1_140, defensive: true, conf: true, per: true },
  { id: "deadbeef" + "0".repeat(56), name: "Kamino · USDC targeted", band: "Balanced",     tvl_m: 2.41, apy_bps: 921, defensive: false, conf: false, per: false },
];

export default function Page() {
  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            vault index
          </p>
          <h1 className="text-display text-[24px] mt-1">Vaults</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/treasury/new"><Button variant="primary" size="sm">New treasury</Button></Link>
        </div>
      </header>

      <Panel surface="raised" density="dense">
        <table className="w-full text-[12px] font-mono">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] text-left">
              <th className="py-2 pr-2">vault</th>
              <th className="py-2 pr-2">id</th>
              <th className="py-2 pr-2">band</th>
              <th className="py-2 pr-2 text-right">tvl</th>
              <th className="py-2 pr-2 text-right">apy 30d</th>
              <th className="py-2 pr-2">flags</th>
              <th className="py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {VAULTS.map((v) => (
              <tr key={v.id} className="border-t border-[color:var(--color-line-soft)] hover:bg-[color:var(--color-line-soft)]">
                <td className="py-2 pr-2 text-[color:var(--color-ink-primary)]">{v.name}</td>
                <td className="py-2 pr-2"><IdentifierMono value={v.id} size="xs" /></td>
                <td className="py-2 pr-2 text-[color:var(--color-ink-secondary)]">{v.band}</td>
                <td className="py-2 pr-2 text-right">${v.tvl_m.toFixed(2)}M</td>
                <td className="py-2 pr-2 text-right text-[color:var(--color-accent-execute)]">{(v.apy_bps / 100).toFixed(2)}%</td>
                <td className="py-2 pr-2 space-x-1">
                  {v.defensive ? <AlertPill severity="warn">defensive</AlertPill> : null}
                  {v.conf ? <AlertPill severity="zk">confidential</AlertPill> : null}
                  {v.per  ? <AlertPill severity="proof">PER</AlertPill> : null}
                </td>
                <td className="py-2 text-right">
                  <Link href={`/vault/${v.id}`}>
                    <Button variant="ghost" size="sm">open →</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

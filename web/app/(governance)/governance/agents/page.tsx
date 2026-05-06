// /governance/agents — Scoped keepers roster (Phase 22 §13.3).

import { Panel } from "@/components/primitives/Panel";
import { Button } from "@/components/primitives/Button";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";
import { AlertPill } from "@/components/primitives/AlertPill";

interface Keeper {
  pubkey: string;
  role: string;
  valid_until_slot: number;
  actions_used: number;
  max_actions: number;
  notional_used_bps: number;
  notional_max_bps: number;
  vault_id: string;
}

const KEEPERS: Keeper[] = [
  { pubkey: "0xa1" + "f".repeat(62), role: "RebalanceKeeper",   vault_id: "0xab12...", valid_until_slot: 245_080_000, actions_used: 12, max_actions: 24, notional_used_bps: 4_200, notional_max_bps: 10_000 },
  { pubkey: "0xa2" + "f".repeat(62), role: "SettlementKeeper",  vault_id: "0xab12...", valid_until_slot: 245_120_000, actions_used: 4,  max_actions: 12, notional_used_bps: 1_800, notional_max_bps: 6_000  },
  { pubkey: "0xa3" + "f".repeat(62), role: "AttestationKeeper", vault_id: "0xab12...", valid_until_slot: 245_080_000, actions_used: 18, max_actions: 60, notional_used_bps: 0,     notional_max_bps: 0      },
  { pubkey: "0xa4" + "f".repeat(62), role: "AltKeeper",         vault_id: "0xab12...", valid_until_slot: 245_300_000, actions_used: 1,  max_actions: 6,  notional_used_bps: 0,     notional_max_bps: 0      },
  { pubkey: "0xa5" + "f".repeat(62), role: "ArchiveKeeper",     vault_id: "—",         valid_until_slot: 245_300_000, actions_used: 86, max_actions: 240, notional_used_bps: 0,    notional_max_bps: 0      },
  { pubkey: "0xa6" + "f".repeat(62), role: "HedgeKeeper",       vault_id: "0x0102...", valid_until_slot: 245_060_000, actions_used: 3,  max_actions: 8,  notional_used_bps: 2_100, notional_max_bps: 4_500  },
  { pubkey: "0xa7" + "f".repeat(62), role: "PythPostKeeper",    vault_id: "—",         valid_until_slot: 245_300_000, actions_used: 240,max_actions: 480, notional_used_bps: 0,    notional_max_bps: 0      },
];

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          phase 15 · scoped keeper roster
        </p>
        <h1 className="text-display text-[28px] mt-2">Scoped keepers</h1>
        <p className="mt-2 text-[13px] text-[color:var(--color-ink-secondary)] max-w-[760px]">
          Each role gets a distinct on-chain key with a ratcheted mandate (allowed
          program × ix bitset, valid_until_slot, max_actions, notional caps).
          Renewals open a Squads queue entry.
        </p>
      </header>

      <Panel surface="raised" density="dense">
        <table className="w-full text-[12px] font-mono">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] text-left">
              <th className="py-2 pr-2">role</th>
              <th className="py-2 pr-2">pubkey</th>
              <th className="py-2 pr-2">vault</th>
              <th className="py-2 pr-2">valid until</th>
              <th className="py-2 pr-2">actions</th>
              <th className="py-2 pr-2">notional</th>
              <th className="py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {KEEPERS.map((k) => {
              const aPct = Math.round((k.actions_used / k.max_actions) * 100);
              const nPct = k.notional_max_bps > 0 ? Math.round((k.notional_used_bps / k.notional_max_bps) * 100) : 0;
              const aSev = aPct > 80 ? "warn" : "ok";
              const nSev = nPct > 80 ? "warn" : "ok";
              return (
                <tr key={k.pubkey} className="border-t border-[color:var(--color-line-soft)]">
                  <td className="py-2 pr-2 text-[color:var(--color-ink-primary)]">{k.role}</td>
                  <td className="py-2 pr-2"><IdentifierMono value={k.pubkey} size="xs" /></td>
                  <td className="py-2 pr-2 text-[color:var(--color-ink-secondary)]">{k.vault_id}</td>
                  <td className="py-2 pr-2 text-[color:var(--color-ink-secondary)]">{k.valid_until_slot.toLocaleString()}</td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <span>{k.actions_used} / {k.max_actions}</span>
                      <AlertPill severity={aSev}>{aPct}%</AlertPill>
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    {k.notional_max_bps === 0 ? (
                      <span className="text-[color:var(--color-ink-tertiary)]">n/a</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{(k.notional_used_bps / 100).toFixed(0)}% / {(k.notional_max_bps / 100).toFixed(0)}%</span>
                        <AlertPill severity={nSev}>{nPct}%</AlertPill>
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" size="sm">renew</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

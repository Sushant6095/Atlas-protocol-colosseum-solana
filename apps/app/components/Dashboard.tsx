// Operator dashboard — Atlas's app.atlasfi.in landing.
//
// Mirrors the Lulo app.lulo.fi quality bar in our palette:
//
//   1. DemoBanner       — "Demo View: Connect…" until wallet attaches.
//   2. NavBar           — logo + balance-toggle + theme-toggle + help + wallet.
//   3. Marquee          — protocol yields strip from PR 2.
//   4. SummaryBlock     — Total Value (subscript decimals) + Earned Today + APY pill.
//                         Right side: Withdraw (ghost) + Deposit (gradient).
//   5. Tabs             — Portfolio / Activity / Referrals.
//   6. PortfolioTab     — BarChart + range toggle + "Atlas Balances" + vault rows.
//   7. ActivityTab      — Grouped-by-month feed with tone-coloured rows.
//   8. ReferralsTab     — v1.1 placeholder.

"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, Eye, EyeOff,
  HelpCircle, MoonStar, PlusCircle, Wallet,
} from "lucide-react";
import {
  Marquee, adaptDefiLlama,
  MonoNumber, StatusPill, Tabs, Identifier, Button,
  DemoBanner, BarChart, Panel,
  type TabItem, type BarDatum,
} from "@atlas/ui";

// ─────────────────────────────────────────────────────────────────
// Mock data — wires to @atlas/sdk in PR 7. Stays here while the
// operator API surfaces are still mock-fed.
// ─────────────────────────────────────────────────────────────────

const MARQUEE_SEED = adaptDefiLlama([
  { pool: "kamino-usdc",   project: "kamino",   symbol: "USDC", apy: 11.84, tvlUsd: 410_000_000 },
  { pool: "drift-ksol",    project: "drift",    symbol: "kSOL", apy: 18.20, tvlUsd: 180_000_000 },
  { pool: "marginfi-usdc", project: "marginfi", symbol: "USDC", apy:  9.40, tvlUsd: 220_000_000 },
  { pool: "jupiter-jlp",   project: "jupiter",  symbol: "JLP",  apy: 14.10, tvlUsd: 1_200_000_000 },
  { pool: "raydium-sol",   project: "raydium",  symbol: "SOL-USDC", apy: 24.10, tvlUsd: 84_000_000 },
  { pool: "orca-jitosol",  project: "orca",     symbol: "JITOSOL", apy: 19.00, tvlUsd: 50_000_000 },
  { pool: "marginfi-sol",  project: "marginfi", symbol: "SOL",  apy:  6.20, tvlUsd: 140_000_000 },
  { pool: "kamino-pyusd",  project: "kamino",   symbol: "PYUSD", apy: 12.30, tvlUsd: 38_000_000 },
]);

interface PortfolioVault {
  symbol: string;
  status: "verified" | "boosted";
  apyPct: number;
  balanceUsd: number;
  shareCount: number;
  brand: string;
  topProtocol: string;
  topShareBps: number;
}

const VAULTS: PortfolioVault[] = [
  { symbol: "atUSDC-stable",   status: "verified", apyPct:  4.92, balanceUsd: 2341.21, shareCount:  0.42, brand: "#3CE39A", topProtocol: "Kamino",   topShareBps: 6200 },
  { symbol: "atUSDC-boost",    status: "boosted",  apyPct:  8.67, balanceUsd: 18402.55, shareCount: 18.40, brand: "#A682FF", topProtocol: "Drift",    topShareBps: 4800 },
  { symbol: "atSOL-hedged",    status: "boosted",  apyPct: 11.84, balanceUsd: 41210.92, shareCount: 12.71, brand: "#76E4F7", topProtocol: "Marginfi", topShareBps: 3900 },
  { symbol: "atJLP-yield",     status: "verified", apyPct:  6.20, balanceUsd: 38851.24, shareCount:  4.18, brand: "#C7F284", topProtocol: "Jupiter",  topShareBps: 7100 },
];

interface ActivityRow {
  id: string;
  kind: "deposit" | "withdraw" | "rebalance" | "prewarm";
  date: string;          // ISO YYYY-MM-DD
  amountUsd: number;     // signed
  txSig: string;
}

const ACTIVITY: ActivityRow[] = [
  { id: "a1", kind: "deposit",   date: "2026-05-07", amountUsd:  200.00, txSig: "5dT9v...2Vvc" },
  { id: "a2", kind: "rebalance", date: "2026-05-07", amountUsd:    0.00, txSig: "8eK1f...rL3p" },
  { id: "a3", kind: "deposit",   date: "2026-05-04", amountUsd: 1500.00, txSig: "9pQ2c...JZmA" },
  { id: "a4", kind: "prewarm",   date: "2026-05-02", amountUsd:    0.00, txSig: "4rX5a...m8Hz" },
  { id: "a5", kind: "rebalance", date: "2026-04-29", amountUsd:    0.00, txSig: "7uT2x...kP91" },
  { id: "a6", kind: "withdraw",  date: "2026-04-22", amountUsd: -350.00, txSig: "3cM4b...VqW0" },
  { id: "a7", kind: "deposit",   date: "2026-04-12", amountUsd: 2000.00, txSig: "6fH8j...xY02" },
  { id: "a8", kind: "rebalance", date: "2026-04-05", amountUsd:    0.00, txSig: "1aB2c...DgF7" },
];

const EARNINGS: BarDatum[] = [
  { label: "aug", value:  410 },
  { label: "sep", value:  580 },
  { label: "oct", value:  720 },
  { label: "nov", value:  640 },
  { label: "dec", value:  830 },
  { label: "jan", value:  920 },
  { label: "feb", value: 1080 },
  { label: "mar", value: 1240 },
  { label: "apr", value: 1410 },
  { label: "may", value:  517 },
];

// ─────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────

interface DashboardProps {
  /** When false, the DemoBanner shows. Default false (operator
   *  comes here disconnected; connecting flips to true). */
  connected?: boolean;
  /** Wallet pubkey if connected. */
  walletPubkey?: string;
  /** Connect handler — wired from the host (web vs apps/app). */
  onConnect?: () => void;
}

export function Dashboard({
  connected = false, walletPubkey, onConnect,
}: DashboardProps): JSX.Element {
  const [hideBalances, setHideBalances] = useState(false);
  const [activeTab, setActiveTab] = useState("portfolio");
  const [range, setRange] = useState<"week" | "month" | "year" | "lifetime">("year");

  const tabs: TabItem[] = [
    { id: "portfolio", label: "Portfolio" },
    { id: "activity",  label: "Activity",  count: ACTIVITY.length },
    { id: "referrals", label: "Referrals" },
  ];

  const totalUsd  = VAULTS.reduce((acc, v) => acc + v.balanceUsd, 0);
  const earnedUsd = 17.25; // mock — wires to /api/v1/earnings/today

  return (
    <div className="min-h-screen flex flex-col">
      <DemoBanner connected={connected} onConnect={onConnect} />

      <NavBar
        connected={connected}
        walletPubkey={walletPubkey}
        hideBalances={hideBalances}
        onToggleBalances={() => setHideBalances((v) => !v)}
        onConnect={onConnect}
      />

      <Marquee items={MARQUEE_SEED} />

      <main className="flex-1 px-6 md:px-12 py-12 max-w-[1280px] mx-auto w-full">
        <SummaryBlock
          totalUsd={totalUsd}
          earnedUsd={earnedUsd}
          apyPct={5.39}
          hideBalances={hideBalances}
          onConnect={onConnect}
        />

        <div className="mt-12">
          <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="mt-10">
          {activeTab === "portfolio" && (
            <PortfolioTab earnings={EARNINGS} vaults={VAULTS} range={range} onRange={setRange} hideBalances={hideBalances} />
          )}
          {activeTab === "activity" && (
            <ActivityTab rows={ACTIVITY} connected={connected} onConnect={onConnect} />
          )}
          {activeTab === "referrals" && <ReferralsTab />}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NavBar
// ─────────────────────────────────────────────────────────────────

function NavBar({
  connected, walletPubkey, hideBalances, onToggleBalances, onConnect,
}: {
  connected: boolean;
  walletPubkey?: string;
  hideBalances: boolean;
  onToggleBalances: () => void;
  onConnect?: () => void;
}): JSX.Element {
  return (
    <header
      className="sticky top-0 z-[var(--z-nav,100)] flex items-center gap-4 px-6 md:px-12 h-14 border-b backdrop-blur-xl"
      style={{
        borderColor: "var(--color-line-soft)",
        background: "color-mix(in oklab, var(--color-surface-base) 80%, transparent)",
      }}
    >
      {/* Brand mark — using the Pleiades from atlas/web is not
          reachable from apps/app yet, so render the inline glyph
          here. Kept tight (h-7). */}
      <a href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight" style={{ color: "var(--color-ink-primary)" }}>
        <PleiadesGlyph className="h-7 w-7" />
        <span className="font-display text-lg">Atlas</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] mt-1" style={{ color: "var(--color-ink-tertiary)" }}>
          app
        </span>
      </a>

      <div className="flex-1" />

      <button
        type="button"
        aria-label={hideBalances ? "Show balances" : "Hide balances"}
        onClick={onToggleBalances}
        className="h-8 w-8 grid place-items-center rounded-[var(--radius-sm)] border transition-colors hover:text-[color:var(--color-ink-primary)]"
        style={{
          color: "var(--color-ink-secondary)",
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-raised)",
        }}
      >
        {hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        type="button"
        aria-label="Theme"
        className="h-8 w-8 grid place-items-center rounded-[var(--radius-sm)] border transition-colors hover:text-[color:var(--color-ink-primary)]"
        style={{
          color: "var(--color-ink-secondary)",
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-raised)",
        }}
      >
        <MoonStar className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Help"
        className="h-8 w-8 grid place-items-center rounded-[var(--radius-sm)] border transition-colors hover:text-[color:var(--color-ink-primary)]"
        style={{
          color: "var(--color-ink-secondary)",
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-raised)",
        }}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {connected && walletPubkey ? (
        <span
          className="inline-flex items-center gap-2 px-3 h-8 rounded-full border font-mono text-[11px]"
          style={{
            color: "var(--color-ink-primary)",
            borderColor: "var(--color-line-soft)",
            background: "var(--color-surface-raised)",
          }}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-accent-execute)" }} />
          <Identifier value={walletPubkey} edge={4} tone="default" size="xs" />
        </span>
      ) : (
        <Button onClick={onConnect} variant="primary" size="sm">
          <Wallet className="h-3.5 w-3.5" />
          Connect
        </Button>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────
// Summary block — total value (subscript) + earned + APY + actions
// ─────────────────────────────────────────────────────────────────

function SummaryBlock({
  totalUsd, earnedUsd, apyPct, hideBalances, onConnect,
}: {
  totalUsd: number;
  earnedUsd: number;
  apyPct: number;
  hideBalances: boolean;
  onConnect?: () => void;
}): JSX.Element {
  const hidden = hideBalances ? "•••••" : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Total value
          </p>
          {hidden ? (
            <p className="mt-2 font-mono" style={{ color: "var(--color-ink-tertiary)", fontSize: "3rem" }}>{hidden}</p>
          ) : (
            <div className="mt-2">
              <MonoNumber value={totalUsd} prefix="$" precision={2} subscript size="hero" />
            </div>
          )}
          <p className="mt-3 inline-flex items-center gap-2 font-mono text-sm" style={{ color: "var(--color-ink-secondary)" }}>
            <span>{apyPct.toFixed(2)}% APY</span>
            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-accent-execute)", animation: "atlas-ui-pulse 1.5s ease-in-out infinite" }} />
          </p>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Earned (today)
          </p>
          {hidden ? (
            <p className="mt-2 font-mono" style={{ color: "var(--color-ink-tertiary)", fontSize: "3rem" }}>{hidden}</p>
          ) : (
            <div className="mt-2">
              <MonoNumber value={earnedUsd} prefix="$" precision={2} subscript size="xl" />
            </div>
          )}
          <p className="mt-3 font-body text-sm" style={{ color: "var(--color-ink-tertiary)" }}>
            across {VAULTS.length} active vaults
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="md">
          <ArrowUpFromLine className="h-4 w-4" />
          Withdraw
        </Button>
        <Button variant="primary" size="md" onClick={onConnect}>
          <ArrowDownToLine className="h-4 w-4" />
          Deposit
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Portfolio tab
// ─────────────────────────────────────────────────────────────────

function PortfolioTab({
  earnings, vaults, range, onRange, hideBalances,
}: {
  earnings: BarDatum[];
  vaults: PortfolioVault[];
  range: "week" | "month" | "year" | "lifetime";
  onRange: (r: "week" | "month" | "year" | "lifetime") => void;
  hideBalances: boolean;
}): JSX.Element {
  const ranges: { id: typeof range; label: string }[] = [
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "year", label: "Year" },
    { id: "lifetime", label: "Lifetime" },
  ];

  return (
    <div className="space-y-12">
      <Panel surface="raised" density="default">
        <div className="flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-display font-medium tracking-tight text-2xl" style={{ color: "var(--color-ink-primary)" }}>
              Earnings
            </h2>
            <p className="mt-1 font-body text-sm" style={{ color: "var(--color-ink-tertiary)" }}>
              Monthly realized yield, on-chain verified.
            </p>
          </div>
          <StatusPill variant="live" compact>live</StatusPill>
        </div>

        <div className="mt-8">
          <BarChart data={earnings} />
        </div>

        <div className="mt-6 inline-flex items-center gap-1 p-1 rounded-[var(--radius-sm)] border"
             style={{ borderColor: "var(--color-line-soft)", background: "var(--color-surface-sunken)" }}>
          {ranges.map((r) => {
            const on = r.id === range;
            return (
              <button
                key={r.id}
                onClick={() => onRange(r.id)}
                className="px-3 py-1.5 rounded-[var(--radius-xs)] font-mono text-[11px] uppercase tracking-[0.08em] transition-colors"
                style={{
                  color: on ? "var(--color-ink-primary)" : "var(--color-ink-tertiary)",
                  background: on ? "var(--color-surface-raised)" : "transparent",
                  borderBottom: on ? "1px solid var(--color-accent-electric)" : "1px solid transparent",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </Panel>

      <section>
        <header className="flex items-baseline justify-between mb-4">
          <h3 className="font-display font-medium tracking-tight text-xl" style={{ color: "var(--color-ink-primary)" }}>
            Atlas balances
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
            {vaults.length} vaults
          </span>
        </header>

        <div className="rounded-[var(--radius-lg)] border overflow-hidden"
             style={{ borderColor: "var(--color-line-soft)" }}>
          <ul className="divide-y" style={{ borderColor: "var(--color-line-soft)" }}>
            {vaults.map((v) => (
              <li key={v.symbol}>
                <VaultRow vault={v} hideBalances={hideBalances} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function VaultRow({ vault, hideBalances }: { vault: PortfolioVault; hideBalances: boolean }): JSX.Element {
  const sharePct = (vault.topShareBps / 100).toFixed(0);

  return (
    <div
      className="px-5 py-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 transition-colors hover:bg-[color:var(--color-line-soft)]"
      style={{ background: "var(--color-surface-raised)" }}
    >
      <div>
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center h-8 w-8 rounded-full font-mono text-[11px] font-semibold"
            style={{
              background: `color-mix(in oklab, ${vault.brand} 14%, var(--color-surface-base))`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${vault.brand} 35%, transparent)`,
              color: vault.brand,
            }}
          >
            {vault.symbol.slice(2, 4).toUpperCase()}
          </span>
          <div>
            <p className="font-mono text-sm" style={{ color: "var(--color-ink-primary)" }}>
              {vault.symbol}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 font-body text-xs" style={{ color: "var(--color-ink-tertiary)" }}>
              {vault.status === "verified" ? "Verified" : "Boosted"}
              <span aria-hidden>·</span>
              <span>{vault.apyPct.toFixed(2)}% APY</span>
            </p>
          </div>
        </div>

        {/* Allocation bar */}
        <div className="mt-3 flex items-center gap-3 max-w-[480px]">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-line-soft)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${sharePct}%`,
                background: `linear-gradient(90deg, ${vault.brand}, var(--color-accent-electric))`,
              }}
            />
          </div>
          <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
            {sharePct}% {vault.topProtocol}
          </span>
        </div>
      </div>

      <div className="text-left md:text-right">
        {hideBalances ? (
          <span className="font-mono text-2xl" style={{ color: "var(--color-ink-tertiary)" }}>•••••</span>
        ) : (
          <MonoNumber value={vault.balanceUsd} prefix="$" precision={2} subscript size="lg" />
        )}
        <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          {vault.shareCount.toFixed(2)} {vault.symbol}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Activity tab
// ─────────────────────────────────────────────────────────────────

const KIND_TONE: Record<ActivityRow["kind"], { color: string; label: string; sign: string }> = {
  deposit:   { color: "var(--color-accent-execute)", label: "Deposit",   sign: "+" },
  withdraw:  { color: "var(--color-accent-danger)",  label: "Withdrawal",sign: "-" },
  rebalance: { color: "var(--color-accent-zk)",      label: "Rebalance", sign: "~" },
  prewarm:   { color: "var(--color-accent-proof)",   label: "Pre-warm",  sign: "~" },
};

function ActivityTab({
  rows, connected, onConnect,
}: { rows: ActivityRow[]; connected: boolean; onConnect?: () => void }): JSX.Element {
  // Group by month label.
  const groups = useMemo(() => {
    const map = new Map<string, ActivityRow[]>();
    for (const r of rows) {
      const d = new Date(r.date);
      const key = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (!connected || rows.length === 0) {
    return (
      <Panel surface="raised" density="cinematic" className="text-center">
        <p className="font-display font-medium text-2xl" style={{ color: "var(--color-ink-primary)" }}>
          No activity yet.
        </p>
        <p className="mt-3 font-body text-sm" style={{ color: "var(--color-ink-secondary)" }}>
          Make your first deposit to see your history here.
        </p>
        <div className="mt-8 flex justify-center">
          <Button variant="primary" onClick={onConnect}>
            <PlusCircle className="h-4 w-4" />
            Make a deposit
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map(([label, items]) => (
        <section key={label}>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
              style={{ color: "var(--color-ink-tertiary)" }}>
            {label}
          </h3>
          <div className="rounded-[var(--radius-lg)] border overflow-hidden"
               style={{ borderColor: "var(--color-line-soft)" }}>
            <ul className="divide-y" style={{ borderColor: "var(--color-line-soft)" }}>
              {items.map((r) => (
                <li key={r.id}>
                  <ActivityRowView row={r} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}

function ActivityRowView({ row }: { row: ActivityRow }): JSX.Element {
  const tone = KIND_TONE[row.kind];
  const dateStr = new Date(row.date).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  const showAmount = row.amountUsd !== 0;

  return (
    <div className="px-5 py-4 grid grid-cols-[auto_1fr_auto] items-center gap-4 transition-colors hover:bg-[color:var(--color-line-soft)]"
         style={{ background: "var(--color-surface-raised)" }}>
      <span
        className="grid place-items-center h-8 w-8 rounded-full"
        style={{
          background: `color-mix(in oklab, ${tone.color} 14%, var(--color-surface-base))`,
          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tone.color} 35%, transparent)`,
          color: tone.color,
          fontSize: 12,
        }}
        aria-hidden
      >
        {tone.sign}
      </span>

      <div>
        <p className="font-mono text-sm" style={{ color: "var(--color-ink-primary)" }}>
          {tone.label}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-2 font-mono text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          <span>{dateStr}</span>
          <span aria-hidden>·</span>
          <Identifier value={row.txSig} edge={4} tone="muted" size="xs" cluster="mainnet" kind="tx" />
        </p>
      </div>

      <div className="text-right">
        {showAmount ? (
          <span
            className="font-mono font-semibold tabular-nums"
            style={{ color: tone.color, fontSize: 16 }}
          >
            {row.amountUsd > 0 ? "+" : "-"}${Math.abs(row.amountUsd).toFixed(2)}
          </span>
        ) : (
          <span className="font-mono text-sm" style={{ color: "var(--color-ink-tertiary)" }}>—</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Referrals tab
// ─────────────────────────────────────────────────────────────────

function ReferralsTab(): JSX.Element {
  return (
    <Panel surface="raised" density="cinematic" className="text-center">
      <p className="font-display font-medium text-2xl" style={{ color: "var(--color-ink-primary)" }}>
        Referrals coming in v1.1
      </p>
      <p className="mt-3 font-body text-sm" style={{ color: "var(--color-ink-secondary)" }}>
        We're building a referral surface that lets you share verified-treasury
        proofs with your network. Sign up below to be notified when it ships.
      </p>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pleiades inline glyph (avoids importing from atlas/web)
// ─────────────────────────────────────────────────────────────────

function PleiadesGlyph({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="atlas-app-pleiades" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A682FF" />
          <stop offset="1" stopColor="#3F8CFF" />
        </linearGradient>
      </defs>
      <g stroke="url(#atlas-app-pleiades)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.92">
        <line x1="16" y1="4"  x2="11" y2="14" />
        <line x1="11" y1="14" x2="6"  y2="26" />
        <line x1="16" y1="4"  x2="21" y2="14" />
        <line x1="21" y1="14" x2="26" y2="26" />
        <line x1="11" y1="14" x2="16" y2="19" />
        <line x1="16" y1="19" x2="21" y2="14" />
      </g>
      <circle cx="16" cy="19" r="4.5" fill="#3F8CFF" opacity="0.35" />
      <g fill="#E6EAF2">
        <circle cx="16" cy="4"  r="1.4" />
        <circle cx="11" cy="14" r="1.2" />
        <circle cx="21" cy="14" r="1.2" />
        <circle cx="16" cy="19" r="1.6" />
        <circle cx="6"  cy="26" r="1.2" />
        <circle cx="26" cy="26" r="1.2" />
      </g>
    </svg>
  );
}

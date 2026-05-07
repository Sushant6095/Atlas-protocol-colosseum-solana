"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowUpRight,
  Activity,
  ExternalLink,
  Info,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Lock,
  Unlock,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { findVault, type AtlasVaultMeta, type StrategyLeg } from "@/lib/vaults";
import { fetchPoolChart, formatApy, formatTvl, type DLChartPoint } from "@/lib/markets";
import { ConnectButton } from "@/components/ConnectButton";
import { DepositCard } from "@/components/DepositCard";
import { useSolBalance } from "@/hooks/useSolBalance";
import { useWallet } from "@solana/wallet-adapter-react";
import { fmtSol, CLUSTER } from "@/lib/atlas";
import { Droplet } from "lucide-react";

const TABS = [
  { k: "performance", label: "Performance", icon: <Activity className="h-3.5 w-3.5" /> },
  { k: "info", label: "Vault Info", icon: <Info className="h-3.5 w-3.5" /> },
  { k: "strategies", label: "Strategies", icon: <Layers className="h-3.5 w-3.5" /> },
  { k: "risk", label: "Risk", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  { k: "more", label: "More info", icon: <ExternalLink className="h-3.5 w-3.5" /> },
] as const;
type Tab = (typeof TABS)[number]["k"];

const RANGES = [
  { k: "30d", label: "30D", days: 30 },
  { k: "90d", label: "90D", days: 90 },
  { k: "all", label: "All", days: null as number | null },
] as const;

export default function VaultDetailPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const v = findVault(params.symbol);
  const [tab, setTab] = useState<Tab>("performance");
  const [range, setRange] = useState<(typeof RANGES)[number]["k"]>("90d");
  const [depositMode, setDepositMode] = useState<"deposit" | "withdraw">("deposit");
  const { connected } = useWallet();
  const { data: balance } = useSolBalance();

  if (!v) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold mb-2">Vault not found</h1>
        <button onClick={() => router.push("/vaults")} className="rounded-lg glass px-5 py-2.5 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to vaults
        </button>
      </main>
    );
  }

  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-2">
        <Link href="/vaults" className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-muted)] hover:text-ink-primary transition mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> All vaults
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span className="font-mono text-xs text-[color:var(--color-muted)]">{v.symbol}</span>
            <span className="text-xs px-2 py-1 rounded-md bg-white/5">{v.asset} · {v.type}</span>
            {v.proven && (
              <span className="text-xs px-2 py-1 rounded-md bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> zk-verified
              </span>
            )}
            <span className={`text-xs px-2 py-1 rounded-md ${
              v.status === "Live"
                ? "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]"
                : "bg-[color:var(--color-warn)]/15 text-[color:var(--color-warn)]"
            }`}>{v.status}</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">{v.asset} · {v.symbol}</h1>
          <p className="text-[color:var(--color-muted)] mt-2 max-w-3xl">{v.description}</p>
        </motion.div>
      </section>

      {/* hero stats */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Est. APY" value={formatApy(v.apy)} accent="#29d391" />
          <Stat label="30 Day APY" value={formatApy(v.apy30d)} />
          <Stat label="TVL" value={`$${v.tvl.toLocaleString()}`} />
          <Stat label="Risk score" value={`${v.riskScore} / 5`} accent={v.riskScore >= 4 ? "#ff5cf0" : "#7c5cff"} />
        </div>
      </section>

      {/* main grid */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* tabs */}
            <div className="glass rounded-lg p-1 inline-flex">
              {TABS.map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`relative px-4 py-2 rounded-lg text-sm transition inline-flex items-center gap-1.5 ${
                    tab === t.k ? "text-ink-primary" : "text-[color:var(--color-muted)] hover:text-ink-primary"
                  }`}
                >
                  {tab === t.k && (
                    <motion.span
                      layoutId="vault-tab"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#7c5cff] to-[#29d3ff]"
                      transition={{ type: "spring", duration: 0.4 }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">{t.icon}{t.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {tab === "performance" && <PerformanceTab vault={v} range={range} setRange={setRange} />}
                {tab === "info" && <InfoTab vault={v} />}
                {tab === "strategies" && <StrategiesTab vault={v} />}
                {tab === "risk" && <RiskTab vault={v} />}
                {tab === "more" && <MoreInfoTab vault={v} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* sticky deposit — real wallet flow */}
          <aside>
            <div className="glass rounded-lg p-6 sticky top-28">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold">Your deposits</h3>
                <span className="text-xs text-[color:var(--color-muted)]">$0.00</span>
              </div>

              <div className="flex gap-1 p-1 bg-surface-base/40 rounded-lg mb-5 border border-[color:var(--color-border)]">
                {(["deposit", "withdraw"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDepositMode(m)}
                    className={`relative flex-1 py-2 rounded-lg text-sm font-medium capitalize transition ${
                      depositMode === m ? "text-ink-primary" : "text-[color:var(--color-muted)]"
                    }`}
                  >
                    {depositMode === m && (
                      <motion.span
                        layoutId="dep-pill"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#7c5cff] to-[#29d3ff]"
                        transition={{ type: "spring", duration: 0.4 }}
                      />
                    )}
                    <span className="relative">{m}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={depositMode}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <DepositCard mode={depositMode} />
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 pt-5 border-t border-[color:var(--color-border)] text-xs space-y-2">
                <Row k="You'll receive" v={<span className="font-mono">0.00 {v.symbol}</span>} />
                <Row k="Share value" v={`1.00 ${v.asset}`} />
                <Row k="Performance fee" v={`${v.performanceFeeBps / 100}%`} />
                <Row k="Cluster" v={<code className="text-[color:var(--color-accent-2)]">{CLUSTER}</code>} />
              </div>

              {CLUSTER === "devnet" && connected && balance !== null && balance !== undefined && balance < 1e7 && (
                <a
                  href="https://faucet.solana.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-warn)]/10 px-3 py-2 text-xs hover:bg-[color:var(--color-warn)]/15 transition"
                >
                  <Droplet className="h-3.5 w-3.5 text-[color:var(--color-warn)]" />
                  <span>Low devnet SOL — get more from the faucet →</span>
                </a>
              )}
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">{label}</div>
      <div className="text-2xl font-bold mt-1" style={accent ? { color: accent } : undefined}>{value}</div>
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-muted)]">{k}</span>
      <span>{v}</span>
    </div>
  );
}

/* ======================== TABS ======================== */

function PerformanceTab({
  vault,
  range,
  setRange,
}: {
  vault: AtlasVaultMeta;
  range: (typeof RANGES)[number]["k"];
  setRange: (v: (typeof RANGES)[number]["k"]) => void;
}) {
  const chart = useQuery<DLChartPoint[]>({
    queryKey: ["vault-chart", vault.chartPoolId],
    queryFn: () => (vault.chartPoolId ? fetchPoolChart(vault.chartPoolId) : Promise.resolve([])),
    enabled: !!vault.chartPoolId,
    staleTime: 10 * 60_000,
  });
  const cutoff = (() => {
    const r = RANGES.find((x) => x.k === range)!;
    return r.days ? Date.now() - r.days * 24 * 3_600_000 : 0;
  })();
  const filtered = (chart.data ?? []).filter((p) => new Date(p.timestamp).getTime() >= cutoff);

  return (
    <div className="glass rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-display font-semibold">30-Day APY · Performance · TVL</h3>
        <div className="flex gap-1 p-1 rounded-lg border border-[color:var(--color-border)] bg-surface-base/30">
          {RANGES.map((r) => (
            <button
              key={r.k}
              onClick={() => setRange(r.k)}
              className={`px-3 py-1 text-xs uppercase tracking-wider rounded-md transition ${
                range === r.k ? "bg-white/10 text-ink-primary" : "text-[color:var(--color-muted)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!vault.chartPoolId ? (
        <div className="h-72 flex items-center justify-center text-[color:var(--color-muted)] text-sm">
          Performance history available once vault launches.
        </div>
      ) : chart.isLoading ? (
        <div className="h-72 flex items-center justify-center text-[color:var(--color-muted)] text-sm">
          Loading historical APY…
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={filtered}>
              <defs>
                <linearGradient id="vault-apy-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#29d391" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#29d391" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(t: string) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                stroke="rgba(255,255,255,0.3)"
                tick={{ fontSize: 11 }}
              />
              <YAxis tickFormatter={(v: number) => `${v.toFixed(0)}%`} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "rgba(10,10,14,0.9)", border: "1px solid rgba(124,92,255,0.3)", borderRadius: 12 }}
                labelFormatter={(t: string) => new Date(t).toLocaleDateString()}
                formatter={(v: number) => [`${v.toFixed(2)}%`, "APY"]}
              />
              <Area type="monotone" dataKey="apy" stroke="#29d391" strokeWidth={2} fill="url(#vault-apy-fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function InfoTab({ vault }: { vault: AtlasVaultMeta }) {
  return (
    <div className="glass rounded-lg p-6 space-y-4">
      <h3 className="font-display font-semibold">Vault info</h3>
      <p className="text-sm text-[color:var(--color-muted)] leading-relaxed">{vault.description}</p>
      <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-[color:var(--color-border)]">
        <Row k="Chain" v={vault.chain} />
        <Row k="Asset" v={vault.asset} />
        <Row k="Type" v={vault.type} />
        <Row k="Status" v={vault.status} />
        <Row k="Management fee" v={`${vault.managementFeeBps / 100}%`} />
        <Row k="Performance fee" v={`${vault.performanceFeeBps / 100}%`} />
        <Row k="Deployed" v={vault.deployedAt} />
        <Row k="Strategy commitment" v={<span className="text-[color:var(--color-success)]">Immutable</span>} />
      </div>
    </div>
  );
}

function StrategiesTab({ vault }: { vault: AtlasVaultMeta }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Strategy allocation</h3>
          <span className="text-xs text-[color:var(--color-muted)]">{vault.legs.length} legs</span>
        </div>

        {/* allocation bar */}
        <div className="flex h-3 rounded-full overflow-hidden mb-5">
          {vault.legs.map((leg, i) => (
            <div
              key={leg.name}
              style={{ width: `${leg.allocationPct}%`, background: protoColor(leg.protocol) }}
              title={`${leg.name}: ${leg.allocationPct}%`}
              className={i > 0 ? "border-l border-line-strong" : ""}
            />
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] border-b border-[color:var(--color-border)]">
                <th className="text-left px-3 py-2 font-medium">Strategy</th>
                <th className="text-right px-3 py-2 font-medium">Alloc %</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-right px-3 py-2 font-medium">APY</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {vault.legs.map((leg) => (
                <LegRow key={leg.name} leg={leg} vaultTvl={vault.tvl} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LegRow({ leg, vaultTvl }: { leg: StrategyLeg; vaultTvl: number }) {
  const c = protoColor(leg.protocol);
  const pool = useQuery({
    queryKey: ["leg-chart", leg.poolId],
    queryFn: () => (leg.poolId ? fetchPoolChart(leg.poolId) : Promise.resolve([])),
    enabled: !!leg.poolId,
    staleTime: 10 * 60_000,
  });
  const apy = pool.data && pool.data.length > 0 ? pool.data[pool.data.length - 1].apy : null;
  const amount = (vaultTvl * leg.allocationPct) / 100;

  return (
    <tr className="hover:bg-white/5">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
          <div>
            <div className="font-medium">{leg.name}</div>
            <div className="text-[11px] text-[color:var(--color-muted)] mt-0.5">{leg.description}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right font-mono">{leg.allocationPct.toFixed(2)}%</td>
      <td className="px-3 py-3 text-right font-mono">${Math.round(amount).toLocaleString()}</td>
      <td className="px-3 py-3 text-right font-semibold" style={{ color: c }}>
        {apy != null ? formatApy(apy) : "—"}
      </td>
      <td className="px-3 py-3 text-right">
        {leg.poolId && (
          <Link href={`/markets/${leg.poolId}`} className="inline-flex items-center gap-1 text-xs text-[color:var(--color-accent)] hover:underline">
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </td>
    </tr>
  );
}

function protoColor(p: StrategyLeg["protocol"]): string {
  switch (p) {
    case "Kamino": return "#7c5cff";
    case "Drift": return "#29d3ff";
    case "Jupiter": return "#f7c948";
    case "marginfi": return "#ff7a59";
    case "Jito": return "#29d391";
    case "Sanctum": return "#ff5cf0";
    case "Cambrian": return "#a78bfa";
    case "Idle": return "#6b7280";
    default: return "#6b7280";
  }
}

function RiskTab({ vault }: { vault: AtlasVaultMeta }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[color:var(--color-warn)]" /> Risk assessment
          </h3>
          <span className="text-2xl font-bold">{vault.riskScore} <span className="text-sm text-[color:var(--color-muted)]">/ 5</span></span>
        </div>
        <div className="flex gap-1 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`flex-1 h-1.5 rounded-full ${n <= vault.riskScore ? "bg-gradient-to-r from-[#7c5cff] to-[#ff5cf0]" : "bg-white/5"}`}
            />
          ))}
        </div>

        <div className="space-y-3">
          {vault.riskFactors.map((f) => (
            <div key={f.label} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">{f.label}</div>
                <div className="text-xs text-[color:var(--color-muted)] mt-0.5 leading-relaxed">{f.note}</div>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0 ${
                  f.rating === "High"
                    ? "bg-accent-danger/15 text-accent-danger"
                    : f.rating === "Medium"
                    ? "bg-[color:var(--color-warn)]/15 text-[color:var(--color-warn)]"
                    : "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]"
                }`}
              >
                {f.rating}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoreInfoTab({ vault }: { vault: AtlasVaultMeta }) {
  return (
    <div className="glass rounded-lg p-6 space-y-4">
      <h3 className="font-display font-semibold">More info</h3>
      <div className="space-y-3 text-sm">
        <CopyRow label="Vault program" value={vault.vaultProgram} />
        <CopyRow label="Share mint" value={vault.shareMint} />
        <CopyRow label="Deposit mint" value={vault.depositMint} />
      </div>
      <div className="border-t border-[color:var(--color-border)] pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <a href={vault.docsUrl} className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-3 hover:bg-white/5 transition">
          <span>How proofs work</span> <ArrowUpRight className="h-4 w-4 text-[color:var(--color-accent)]" />
        </a>
        <a href={vault.apiUrl} className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-3 hover:bg-white/5 transition">
          <span>Vault API</span> <ArrowUpRight className="h-4 w-4 text-[color:var(--color-accent)]" />
        </a>
        <a href="/proofs" className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-3 hover:bg-white/5 transition">
          <span>Proof feed</span> <ArrowUpRight className="h-4 w-4 text-[color:var(--color-accent)]" />
        </a>
        <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-3 hover:bg-white/5 transition">
          <span>Source on GitHub</span> <ExternalLink className="h-4 w-4 text-[color:var(--color-accent)]" />
        </a>
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-surface-base/30 p-3">
      <div className="min-w-0">
        <div className="text-xs text-[color:var(--color-muted)]">{label}</div>
        <div className="font-mono text-xs truncate">{value}</div>
      </div>
      <button onClick={copy} className="ml-3 text-[color:var(--color-muted)] hover:text-ink-primary">
        {copied ? <Check className="h-4 w-4 text-[color:var(--color-success)]" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

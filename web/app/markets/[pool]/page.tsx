"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPool,
  fetchPoolChart,
  formatApy,
  formatTvl,
  categorize,
  categoryColor,
  type DLChartPoint,
  type DLPool,
} from "@/lib/markets";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  Info,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { useMemo, useState } from "react";
import Link from "next/link";

const RANGES = [
  { k: "30d", label: "30D", days: 30 },
  { k: "90d", label: "90D", days: 90 },
  { k: "180d", label: "180D", days: 180 },
  { k: "all", label: "All", days: null as number | null },
] as const;
type RangeKey = (typeof RANGES)[number]["k"];

export default function PoolDetailPage() {
  const params = useParams<{ pool: string }>();
  const router = useRouter();
  const poolId = params.pool;
  const [range, setRange] = useState<RangeKey>("90d");
  const [metric, setMetric] = useState<"apy" | "tvl">("apy");

  const poolQ = useQuery<DLPool | null>({
    queryKey: ["pool", poolId],
    queryFn: () => fetchPool(poolId),
    enabled: !!poolId,
    staleTime: 5 * 60_000,
  });

  const chartQ = useQuery<DLChartPoint[]>({
    queryKey: ["pool-chart", poolId],
    queryFn: () => fetchPoolChart(poolId),
    enabled: !!poolId,
    staleTime: 10 * 60_000,
  });

  const filtered = useMemo(() => {
    if (!chartQ.data) return [];
    const r = RANGES.find((x) => x.k === range)!;
    if (!r.days) return chartQ.data;
    const cutoff = Date.now() - r.days * 24 * 3_600_000;
    return chartQ.data.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
  }, [chartQ.data, range]);

  if (poolQ.isLoading) {
    return <Loading />;
  }
  if (!poolQ.data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-20 text-center">
        <div className="text-2xl font-semibold mb-2">Pool not found</div>
        <div className="text-[color:var(--color-muted)] mb-6">
          This pool no longer exists in DeFiLlama&apos;s registry.
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl glass px-5 py-2.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </main>
    );
  }

  const p = poolQ.data;
  const cat = categorize(p);
  const color = categoryColor(cat);

  const stats = computeStats(filtered);

  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-6">
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-muted)] hover:text-white transition mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All markets
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md"
                style={{ background: `${color}22`, color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                {cat}
              </span>
              <span className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
                {p.project.replace(/-/g, " ")}
              </span>
              {p.stablecoin && (
                <span className="text-xs px-2 py-1 rounded-md bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]">
                  Stablecoin
                </span>
              )}
              {p.ilRisk === "yes" && (
                <span className="text-xs px-2 py-1 rounded-md bg-[color:var(--color-warn)]/15 text-[color:var(--color-warn)]">
                  IL risk
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{p.symbol}</h1>
            {p.poolMeta && (
              <p className="text-[color:var(--color-muted)]">{p.poolMeta}</p>
            )}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
            <Stat label="Current APY" value={formatApy(p.apy)} accent={color} />
            <Stat label="TVL" value={formatTvl(p.tvlUsd)} />
            <Stat label="Chain" value={p.chain} />
          </div>
        </motion.div>
      </section>

      {/* chart */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1 p-1 rounded-lg border border-[color:var(--color-border)] bg-black/30">
              {(["apy", "tvl"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-md transition ${
                    metric === m ? "bg-white/10 text-white" : "text-[color:var(--color-muted)]"
                  }`}
                >
                  {m === "apy" ? "APY" : "TVL"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg border border-[color:var(--color-border)] bg-black/30">
              {RANGES.map((r) => (
                <button
                  key={r.k}
                  onClick={() => setRange(r.k)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-md transition ${
                    range === r.k ? "bg-white/10 text-white" : "text-[color:var(--color-muted)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {chartQ.isLoading && (
            <div className="h-80 flex items-center justify-center text-[color:var(--color-muted)] text-sm">
              Fetching historical {metric}…
            </div>
          )}
          {chartQ.error && (
            <div className="h-80 flex items-center justify-center text-red-400 text-sm">
              Chart upstream unavailable.
            </div>
          )}
          {chartQ.data && filtered.length > 0 && (
            <div className="h-80">
              <ResponsiveContainer>
                {metric === "apy" ? (
                  <AreaChart data={filtered}>
                    <defs>
                      <linearGradient id="apy-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={fmtDate}
                      stroke="rgba(255,255,255,0.3)"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                      stroke="rgba(255,255,255,0.3)"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(10,10,14,0.9)",
                        border: "1px solid rgba(124,92,255,0.3)",
                        borderRadius: 12,
                        backdropFilter: "blur(20px)",
                      }}
                      labelFormatter={fmtDate}
                      formatter={(v: number) => [`${v.toFixed(2)}%`, "APY"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="apy"
                      stroke={color}
                      strokeWidth={2}
                      fill="url(#apy-fill)"
                    />
                    <Line type="monotone" dataKey="apyBase" stroke="#29d391" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                    <Legend />
                  </AreaChart>
                ) : (
                  <AreaChart data={filtered}>
                    <defs>
                      <linearGradient id="tvl-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#29d3ff" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#29d3ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="timestamp" tickFormatter={fmtDate} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => formatTvl(v)} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(10,10,14,0.9)",
                        border: "1px solid rgba(41,211,255,0.3)",
                        borderRadius: 12,
                        backdropFilter: "blur(20px)",
                      }}
                      labelFormatter={fmtDate}
                      formatter={(v: number) => [formatTvl(v), "TVL"]}
                    />
                    <Area type="monotone" dataKey="tvlUsd" stroke="#29d3ff" strokeWidth={2} fill="url(#tvl-fill)" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* min/max/avg breakdown */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[color:var(--color-border)]">
              <BreakdownStat label={`Min ${metric.toUpperCase()}`} value={metric === "apy" ? formatApy(stats.min) : formatTvl(stats.min)} />
              <BreakdownStat label={`Avg ${metric.toUpperCase()}`} value={metric === "apy" ? formatApy(stats.avg) : formatTvl(stats.avg)} />
              <BreakdownStat label={`Max ${metric.toUpperCase()}`} value={metric === "apy" ? formatApy(stats.max) : formatTvl(stats.max)} />
            </div>
          )}
        </div>
      </section>

      {/* info + deposit */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <InfoCard pool={p} />
            <RewardsCard pool={p} />
            <RiskCard pool={p} />
          </div>

          <aside>
            <div className="glass rounded-2xl p-6 sticky top-28 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Route via Atlas</h3>
                <ShieldCheck className="h-4 w-4 text-[color:var(--color-success)]" />
              </div>
              <p className="text-xs text-[color:var(--color-muted)] leading-relaxed">
                Deposit USDC into Atlas Vault — the AI rebalancer will allocate to this pool when its
                risk-adjusted yield wins. Every move arrives with an SP1 proof.
              </p>
              <Link
                href="/vault"
                className="block w-full text-center py-3 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] text-white font-medium glow-accent hover:opacity-95 transition"
              >
                Open Atlas Vault
              </Link>

              <div className="pt-4 border-t border-[color:var(--color-border)] space-y-3 text-xs">
                <Row k="Project" v={<span className="capitalize">{p.project.replace(/-/g, " ")}</span>} />
                <Row k="Asset" v={p.symbol} />
                <Row k="Type" v={cat} />
                <Row k="Exposure" v={p.exposure ?? "single"} />
                <Row k="IL risk" v={p.ilRisk === "yes" ? "Yes" : "No"} />
              </div>

              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] px-3 py-3 text-sm hover:bg-white/5 transition"
                >
                  <span className="capitalize">Deposit directly on {p.project.replace(/-/g, " ")}</span>
                  <ArrowUpRight className="h-4 w-4 text-[color:var(--color-accent)]" />
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

function fmtDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function computeStats(rows: DLChartPoint[]): { min: number; max: number; avg: number } | null {
  if (rows.length === 0) return null;
  const v = rows.map((r) => r.apy ?? 0);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const avg = v.reduce((s, x) => s + x, 0) / v.length;
  return { min, max, avg };
}

function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-32 text-center">
      <div className="inline-block h-8 w-8 rounded-full border-2 border-[color:var(--color-accent)] border-t-transparent animate-spin" />
      <div className="mt-4 text-sm text-[color:var(--color-muted)]">Loading pool…</div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass rounded-xl p-4"
    >
      <div className="text-xs text-[color:var(--color-muted)] uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </motion.div>
  );
}

function BreakdownStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[color:var(--color-muted)] uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold font-mono mt-1">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-muted)]">{k}</span>
      <span className="capitalize">{v}</span>
    </div>
  );
}

function InfoCard({ pool }: { pool: DLPool }) {
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-[color:var(--color-accent-2)]" /> Pool info
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Row k="Asset symbol" v={pool.symbol} />
        <Row k="Project" v={<span className="capitalize">{pool.project.replace(/-/g, " ")}</span>} />
        <Row k="Chain" v={pool.chain} />
        <Row k="Exposure" v={pool.exposure ?? "—"} />
        <Row k="Pool ID" v={<code className="text-[10px]">{pool.pool.slice(0, 18)}…</code>} />
        <Row k="Stablecoin" v={pool.stablecoin ? "Yes" : "No"} />
      </div>
    </div>
  );
}

function RewardsCard({ pool }: { pool: DLPool }) {
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-[color:var(--color-success)]" /> APY breakdown
      </h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xs text-[color:var(--color-muted)]">Total APY</div>
          <div className="text-xl font-bold mt-1">{formatApy(pool.apy)}</div>
        </div>
        <div>
          <div className="text-xs text-[color:var(--color-muted)]">Base</div>
          <div className="text-xl font-bold mt-1">{formatApy(pool.apyBase)}</div>
        </div>
        <div>
          <div className="text-xs text-[color:var(--color-muted)]">Reward</div>
          <div className="text-xl font-bold mt-1">{formatApy(pool.apyReward)}</div>
        </div>
      </div>
      {pool.rewardTokens && pool.rewardTokens.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {pool.rewardTokens.map((t) => (
            <span key={t} className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-white/5 text-[color:var(--color-muted)]">
              {t.slice(0, 8)}…
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RiskCard({ pool }: { pool: DLPool }) {
  const cat = categorize(pool);
  const items: Array<[string, string, string]> = [
    ["Smart contract risk", "Inherent — protocol could be exploited.", pool.project.includes("kamino") ? "Audited" : "Audited"],
    ["IL risk", pool.ilRisk === "yes" ? "Yes — LP positions can lose vs. holding." : "No — single-asset position.", pool.ilRisk === "yes" ? "High" : "None"],
    ["Reward token risk", pool.apyReward && pool.apyReward > 0 ? "APY partly paid in reward tokens whose price can move." : "No reward emissions.", pool.apyReward ? "Variable" : "None"],
    ["Strategy fit", `Atlas would route here when ${cat.toLowerCase()} APY wins on a risk-adjusted basis.`, "Auto"],
  ];
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-[color:var(--color-warn)]" /> Risk
      </h3>
      <div className="space-y-3">
        {items.map(([label, desc, badge]) => (
          <div key={label} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <div className="font-medium">{label}</div>
              <div className="text-xs text-[color:var(--color-muted)] mt-0.5 leading-relaxed">{desc}</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-md bg-white/5 flex-shrink-0">{badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

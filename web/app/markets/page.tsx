"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Filter,
  Search,
  TrendingUp,
  Zap,
  Layers,
  Coins,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/Footer";
import { useSolanaYields } from "@/hooks/useSolanaYields";
import { categorize, categoryColor, formatApy, formatTvl, type DLPool } from "@/lib/markets";

const CATS = ["All", "Lending", "LP", "Staking", "Stable"] as const;
type Cat = (typeof CATS)[number];

export default function MarketsPage() {
  const { data, isLoading, error } = useSolanaYields();
  const [cat, setCat] = useState<Cat>("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"apy" | "tvl">("apy");

  const filtered = useMemo(() => {
    if (!data) return [];
    let r = data;
    if (cat !== "All") r = r.filter((p) => categorize(p) === cat);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter(
        (p) =>
          p.project.toLowerCase().includes(s) ||
          p.symbol.toLowerCase().includes(s) ||
          (p.poolMeta?.toLowerCase().includes(s) ?? false),
      );
    }
    return [...r].sort((a, b) =>
      sort === "apy" ? (b.apy ?? 0) - (a.apy ?? 0) : b.tvlUsd - a.tvlUsd,
    );
  }, [data, cat, q, sort]);

  const hero = useMemo(() => {
    if (!data) return null;
    const top = [...data].sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0)).slice(0, 3);
    return top;
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return { tvl: 0, count: 0, top: 0 };
    return {
      tvl: data.reduce((s, p) => s + p.tvlUsd, 0),
      count: data.length,
      top: data[0]?.apy ?? 0,
    };
  }, [data]);

  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-3"
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] animate-pulse" />
            <span className="text-[color:var(--color-muted)]">Live · DeFiLlama Yields API · Solana</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="text-gradient">Markets</span>
          </h1>
          <p className="text-[color:var(--color-muted)] max-w-2xl">
            Every Solana yield opportunity Atlas can route to. Real APYs, real TVL, refreshed
            every 5 minutes from DeFiLlama. Pick a strategy or let the AI pick for you.
          </p>
        </motion.div>
      </section>

      {/* hero stats */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Hero icon={<TrendingUp />} label="Top APY" value={formatApy(totals.top)} sub="across Solana" />
          <Hero icon={<Coins />} label="Total TVL" value={formatTvl(totals.tvl)} sub="solana yield pools" />
          <Hero icon={<Layers />} label="Pools tracked" value={totals.count.toString()} sub="TVL > $50k" />
          <Hero icon={<Zap />} label="Last refresh" value="< 5 min" sub="DeFiLlama upstream" />
        </div>
      </section>

      {/* feature cards (top 3 by APY) — Kamino-style */}
      {hero && hero.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hero.map((p) => (
              <FeatureCard key={p.pool} pool={p} />
            ))}
          </div>
        </section>
      )}

      {/* filters */}
      <section className="mx-auto max-w-6xl px-6 pb-4">
        <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-[color:var(--color-muted)] ml-2" />
          <div className="flex flex-wrap gap-1">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  cat === c
                    ? "bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] text-white"
                    : "text-[color:var(--color-muted)] hover:text-white hover:bg-white/5"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-black/30 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-[color:var(--color-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="kamino, USDC, jitosol…"
              className="bg-transparent outline-none text-sm w-44"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "apy" | "tvl")}
            className="rounded-lg border border-[color:var(--color-border)] bg-black/30 px-3 py-1.5 text-sm"
          >
            <option value="apy">Sort: APY</option>
            <option value="tvl">Sort: TVL</option>
          </select>
        </div>
      </section>

      {/* table */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] border-b border-[color:var(--color-border)]">
                  <th className="text-left px-5 py-3 font-medium">Asset</th>
                  <th className="text-left px-5 py-3 font-medium">Project</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-right px-5 py-3 font-medium">APY</th>
                  <th className="text-right px-5 py-3 font-medium">Base / Reward</th>
                  <th className="text-right px-5 py-3 font-medium">TVL</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {isLoading && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-[color:var(--color-muted)]">Fetching live yields…</td></tr>
                )}
                {error && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-red-400">DeFiLlama API unavailable. Retry in a moment.</td></tr>
                )}
                {filtered.slice(0, 60).map((p, i) => (
                  <Row key={p.pool} pool={p} idx={i} />
                ))}
                {filtered.length === 0 && !isLoading && !error && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-[color:var(--color-muted)]">No matches.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Hero({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)] mb-3">
        <span className="text-[color:var(--color-accent)]">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-[color:var(--color-muted)] mt-1">{sub}</div>
    </motion.div>
  );
}

function FeatureCard({ pool }: { pool: DLPool }) {
  const cat = categorize(pool);
  const c = categoryColor(cat);
  return (
    <motion.a
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      href={pool.url ?? "#"}
      target={pool.url ? "_blank" : undefined}
      rel="noreferrer"
      className="group relative overflow-hidden glass rounded-2xl p-6 block"
    >
      <div
        className="absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition"
        style={{ background: c }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mb-1">{cat}</div>
          <div className="text-xl font-semibold capitalize">{pool.project.replace(/-/g, " ")}</div>
          <div className="text-sm text-[color:var(--color-muted)] mt-1">{pool.symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ color: c }}>
            {formatApy(pool.apy)}
          </div>
          <div className="text-xs text-[color:var(--color-muted)]">APY · {formatTvl(pool.tvlUsd)} TVL</div>
        </div>
      </div>
      <div className="relative mt-5 inline-flex items-center gap-1 text-xs text-[color:var(--color-accent)] group-hover:gap-2 transition-all">
        Deposit on {pool.project} <ArrowUpRight className="h-3 w-3" />
      </div>
    </motion.a>
  );
}

function Row({ pool, idx }: { pool: DLPool; idx: number }) {
  const cat = categorize(pool);
  const color = categoryColor(cat);
  const router = useRouter();
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(0.02 * idx, 0.4) }}
      onClick={() => router.push(`/markets/${pool.pool}`)}
      className="hover:bg-white/5 transition cursor-pointer"
    >
      <td className="px-5 py-3">
        <div className="font-medium">{pool.symbol}</div>
        {pool.poolMeta && (
          <div className="text-xs text-[color:var(--color-muted)]">{pool.poolMeta}</div>
        )}
      </td>
      <td className="px-5 py-3 capitalize">{pool.project.replace(/-/g, " ")}</td>
      <td className="px-5 py-3">
        <span
          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md"
          style={{ background: `${color}22`, color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {cat}
        </span>
      </td>
      <td className="px-5 py-3 text-right font-semibold" style={{ color }}>
        {formatApy(pool.apy)}
      </td>
      <td className="px-5 py-3 text-right text-xs text-[color:var(--color-muted)] font-mono">
        {formatApy(pool.apyBase)} / {formatApy(pool.apyReward)}
      </td>
      <td className="px-5 py-3 text-right font-mono">{formatTvl(pool.tvlUsd)}</td>
      <td className="px-5 py-3 text-right">
        <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-accent)]">
          Details <ArrowUpRight className="h-3 w-3" />
        </span>
      </td>
    </motion.tr>
  );
}

"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Layers, ShieldCheck, Filter, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { VAULTS, type AtlasVaultMeta } from "@/lib/vaults";
import { BorderBeam } from "@/components/magicui/border-beam";

// ElectricBorder uses canvas + ResizeObserver — client-only.
const ElectricBorder = dynamic(
  () => import("@/components/effects/ElectricBorder"),
  { ssr: false },
);

const CATS = ["All", "PUSD", "Stable", "Volatile", "LST", "Hybrid", "RWA", "LP"] as const;
type Cat = (typeof CATS)[number];

// PUSD brand color — accent.zk in Atlas tokens.
const PUSD_ACCENT = "#A682FF";

export default function VaultsPage() {
  const [cat, setCat] = useState<Cat>("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"apy" | "tvl">("apy");

  const list = useMemo(() => {
    let r = VAULTS;
    // PUSD chip is a virtual filter — there is no PUSD vault in the
    // registry yet (PUSD-native vault ships via /vaults/pusd). When
    // the chip is selected we return zero rows so the featured card
    // dominates the grid.
    if (cat === "PUSD") r = [];
    else if (cat !== "All") r = r.filter((v) => v.type === cat);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter(
        (v) =>
          v.symbol.toLowerCase().includes(s) ||
          v.name.toLowerCase().includes(s) ||
          v.asset.toLowerCase().includes(s) ||
          v.protocols.some((p) => p.toLowerCase().includes(s)),
      );
    }
    return [...r].sort((a, b) => (sort === "apy" ? b.apy - a.apy : b.tvl - a.tvl));
  }, [cat, q, sort]);

  const totals = useMemo(() => {
    return {
      tvl: VAULTS.reduce((s, v) => s + v.tvl, 0),
      live: VAULTS.filter((v) => v.status === "Live").length,
      coming: VAULTS.filter((v) => v.status === "Coming soon").length,
      avgApy: VAULTS.reduce((s, v) => s + v.apy, 0) / VAULTS.length,
    };
  }, []);

  return (
    <main>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-3">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs">
            <ShieldCheck className="h-3 w-3 text-[color:var(--color-success)]" />
            <span className="text-[color:var(--color-muted)]">Curated · zk-verified · Solana</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Atlas <span className="text-gradient">Vaults</span>
          </h1>
          <p className="text-[color:var(--color-muted)] max-w-2xl">
            {VAULTS.length} deposit-and-forget vaults across stables, LSTs, RWAs, perps, LPs.
            Each strategy is committed via Poseidon hash and gated by SP1 proof.
          </p>
        </motion.div>
      </section>

      {/* totals */}
      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tile label="Total vaults" value={VAULTS.length.toString()} sub={`${totals.live} live · ${totals.coming} soon`} />
          <Tile label="Avg APY" value={`${totals.avgApy.toFixed(2)}%`} sub="across all vaults" />
          <Tile label="Total TVL" value={`$${totals.tvl.toLocaleString()}`} sub="live vaults" />
          <Tile label="Chains" value="Solana" sub="mainnet-beta" />
        </div>
      </section>

      {/* filters */}
      <section className="mx-auto max-w-6xl px-6 pb-4">
        <div className="glass rounded-lg p-3 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-[color:var(--color-muted)] ml-2" />
          <div className="flex flex-wrap gap-1">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  cat === c
                    ? "bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] text-ink-primary"
                    : "text-[color:var(--color-muted)] hover:text-ink-primary hover:bg-white/5"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-surface-base/30 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-[color:var(--color-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="USDC, JLP, drift…"
              className="bg-transparent outline-none text-sm w-44"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "apy" | "tvl")}
            className="rounded-lg border border-[color:var(--color-border)] bg-surface-base/30 px-3 py-1.5 text-sm"
          >
            <option value="apy">Sort: APY</option>
            <option value="tvl">Sort: TVL</option>
          </select>
        </div>
      </section>

      {/* featured PUSD card — 2x size, BorderBeam halo */}
      <section className="mx-auto max-w-6xl px-6 pb-4">
        <PusdFeaturedCard />
      </section>

      {/* card grid */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((v, i) =>
            i === 0 ? (
              <ElectricBorder
                key={v.symbol}
                color="#3F8CFF"
                speed={1}
                chaos={0.14}
                thickness={2}
                style={{ borderRadius: 16 }}
              >
                <VaultCard vault={v} idx={i} />
              </ElectricBorder>
            ) : (
              <VaultCard key={v.symbol} vault={v} idx={i} />
            ),
          )}
        </div>
      </section>

      {/* full table */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent-2)] mb-3">All vaults</div>
        <div className="glass rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] border-b border-[color:var(--color-border)]">
                  <th className="text-left px-5 py-3 font-medium">Vault</th>
                  <th className="text-left px-5 py-3 font-medium">Asset</th>
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-right px-5 py-3 font-medium">Est. APY</th>
                  <th className="text-right px-5 py-3 font-medium">TVL</th>
                  <th className="text-right px-5 py-3 font-medium">Risk</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {list.map((v) => (
                  <tr key={v.symbol} className="hover:bg-white/5 transition cursor-pointer">
                    <td className="px-5 py-3">
                      <Link href={`/vaults/${v.symbol}` as never} className="block">
                        <div className="font-medium">{v.symbol}</div>
                        <div className="text-xs text-[color:var(--color-muted)] truncate max-w-xs">{v.name}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-3">{v.asset}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-white/5">
                        {v.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-[color:var(--color-success)]">{v.apy.toFixed(2)}%</td>
                    <td className="px-5 py-3 text-right font-mono">${v.tvl.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex font-mono text-xs">{v.riskScore}/5</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-md ${
                        v.status === "Live"
                          ? "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]"
                          : "bg-[color:var(--color-warn)]/15 text-[color:var(--color-warn)]"
                      }`}>{v.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/vaults/${v.symbol}` as never} className="text-xs text-[color:var(--color-accent)] hover:underline inline-flex items-center gap-1">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass rounded-lg p-5">
      <div className="text-xs text-[color:var(--color-muted)] mb-2">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-[color:var(--color-muted)] mt-1">{sub}</div>
    </motion.div>
  );
}

// Featured PUSD card — 2x footprint on the grid, BorderBeam halo,
// PRIMARY RESERVE pin. Links to the dedicated /vaults/pusd detail
// page (not the dynamic [symbol] route — PUSD is a category, not a
// single recipe).
function PusdFeaturedCard(): JSX.Element {
  return (
    <Link
      href="/vaults/pusd"
      className="relative block overflow-hidden rounded-[16px]"
      style={{
        border: `1px solid color-mix(in oklab, ${PUSD_ACCENT} 35%, transparent)`,
        background:
          `linear-gradient(135deg, color-mix(in oklab, ${PUSD_ACCENT} 14%, var(--color-surface-raised)) 0%, var(--color-surface-raised) 60%)`,
        boxShadow: `0 24px 64px -32px ${PUSD_ACCENT}66`,
      }}
    >
      <BorderBeam size={260} duration={9} colorFrom={PUSD_ACCENT} colorTo="#3F8CFF" />
      <BorderBeam size={260} duration={9} delay={4.5} colorFrom="#3F8CFF" colorTo={PUSD_ACCENT} />

      <div className="relative p-6 md:p-8">
        {/* pin label */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{
              borderColor: `color-mix(in oklab, ${PUSD_ACCENT} 45%, transparent)`,
              color: PUSD_ACCENT,
              background: `color-mix(in oklab, ${PUSD_ACCENT} 12%, transparent)`,
            }}
          >
            <Sparkles className="h-3 w-3" /> Primary reserve · PUSD-native
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{
              borderColor: "color-mix(in oklab, var(--color-accent-execute) 30%, transparent)",
              color: "var(--color-accent-execute)",
              background: "color-mix(in oklab, var(--color-accent-execute) 7%, transparent)",
            }}
          >
            <ShieldCheck className="h-3 w-3" /> Token-2022 vetted
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr]">
          {/* left: headline + CTA */}
          <div>
            <h2
              className="font-display text-2xl font-semibold leading-[1.15] md:text-3xl"
              style={{ color: "var(--color-ink-primary)" }}
            >
              Atlas is <span style={{ color: PUSD_ACCENT }}>PUSD-native</span>.
              <br className="hidden md:block" /> Not <em className="not-italic opacity-70">"we also support PUSD"</em>.
            </h2>
            <p className="mt-3 text-sm leading-[1.55]" style={{ color: "var(--color-ink-secondary)" }}>
              12 strategies × 3 risk bands = 12 vault recipes. Every recipe
              denominated, settled, and rebalanced in PUSD with a Token-2022
              extension manifest and a hard <code>atlas-drift-check</code>
              CI gate.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                style={{ background: PUSD_ACCENT, color: "var(--color-surface-base)" }}
              >
                Open PUSD vaults <ArrowUpRight className="h-4 w-4" />
              </span>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                /vaults/pusd
              </span>
            </div>
          </div>

          {/* right: 12 recipe stat */}
          <div
            className="rounded-md border p-5"
            style={{
              borderColor: "var(--color-line-soft)",
              background: "color-mix(in oklab, var(--color-surface-base) 70%, transparent)",
            }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--color-ink-tertiary)" }}
            >
              recipe matrix
            </p>
            <p
              className="mt-1 font-display text-3xl font-semibold tabular-nums leading-none"
              style={{ color: "var(--color-ink-primary)" }}
            >
              12 × 3 <span className="text-base opacity-60">=</span> 12
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--color-ink-secondary)" }}>
              strategies × risk bands = vault recipes
            </p>

            <div className="mt-4 space-y-1.5 font-mono text-[11px]" style={{ color: "var(--color-ink-secondary)" }}>
              {[
                { k: "PusdSafeYield",      bands: "low · mid · hot" },
                { k: "PusdYieldBalanced",  bands: "low · mid · hot" },
                { k: "PusdTreasuryDefense",bands: "low · mid · hot" },
                { k: "PusdJupiterLend",    bands: "low · mid · hot" },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between gap-3">
                  <span style={{ color: "var(--color-ink-primary)" }}>{r.k}</span>
                  <span className="opacity-70">{r.bands}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function VaultCard({ vault, idx }: { vault: AtlasVaultMeta; idx: number }) {
  const live = vault.status === "Live";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(idx * 0.04, 0.3) }}
      whileHover={{ y: -4 }}
      className="glass rounded-lg p-5 relative overflow-hidden"
    >
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-30 bg-[#7c5cff]" />

      <div className="relative flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-3.5 w-3.5 text-[color:var(--color-accent-2)]" />
            <span className="font-mono text-[11px] text-[color:var(--color-muted)] truncate">{vault.symbol}</span>
          </div>
          <h3 className="font-display font-semibold leading-tight truncate">{vault.name}</h3>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-md flex-shrink-0 ${
          live
            ? "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]"
            : "bg-[color:var(--color-warn)]/15 text-[color:var(--color-warn)]"
        }`}>{vault.status}</span>
      </div>

      <div className="relative grid grid-cols-3 gap-2 mb-4">
        <div>
          <div className="text-[10px] text-[color:var(--color-muted)]">APY</div>
          <div className="text-xl font-bold text-[color:var(--color-success)]">{vault.apy.toFixed(2)}%</div>
        </div>
        <div>
          <div className="text-[10px] text-[color:var(--color-muted)]">TVL</div>
          <div className="text-xl font-bold">${vault.tvl.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] text-[color:var(--color-muted)]">Risk</div>
          <div className="text-xl font-bold">{vault.riskScore}<span className="text-xs text-[color:var(--color-muted)]">/5</span></div>
        </div>
      </div>

      <div className="relative mb-4 flex flex-wrap gap-1">
        {vault.protocols.slice(0, 4).map((p) => (
          <span key={p} className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-[color:var(--color-muted)]">
            {p}
          </span>
        ))}
      </div>

      <Link
        href={`/vaults/${vault.symbol}` as never}
        className="relative flex items-center justify-between text-sm rounded-lg bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] text-ink-primary px-4 py-2 font-medium hover:opacity-95"
      >
        Open vault <ArrowUpRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}

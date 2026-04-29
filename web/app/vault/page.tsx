"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine, Droplet, ShieldCheck, TrendingUp, Wallet, Zap } from "lucide-react";
import { ConnectButton } from "@/components/ConnectButton";
import { DepositCard } from "@/components/DepositCard";
import { AllocationChart } from "@/components/AllocationChart";
import { ProofFeed } from "@/components/ProofFeed";
import { StatsCounter } from "@/components/StatsCounter";
import { Footer } from "@/components/Footer";
import { useSolBalance } from "@/hooks/useSolBalance";
import { useWallet } from "@solana/wallet-adapter-react";
import { CLUSTER, fmtSol } from "@/lib/atlas";

export default function VaultPage() {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const { connected } = useWallet();
  const { data: bal } = useSolBalance();

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
            <span className="text-[color:var(--color-muted)]">Live · Solana mainnet-beta · v1</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Atlas <span className="text-gradient">Vault</span>
              </h1>
              <p className="text-[color:var(--color-muted)] mt-2">
                One USDC deposit. Verified AI yield across Solana DeFi.
              </p>
            </div>
            <ConnectButton />
          </div>
        </motion.div>
      </section>

      {/* live stats */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            icon={<TrendingUp />}
            label="Live APY"
            value={
              <span className="text-[color:var(--color-success)]">
                <StatsCounter value={11.84} suffix="%" decimals={2} />
              </span>
            }
            sub="7d annualized"
          />
          <StatTile
            icon={<Zap />}
            label="TVL"
            value={<><span>$</span><StatsCounter value={48211} /></>}
            sub="capped at $1k beta"
          />
          <StatTile
            icon={<ShieldCheck />}
            label="Verified rebalances"
            value={<StatsCounter value={142} />}
            sub="all SP1-proven"
          />
          <StatTile
            icon={<Wallet />}
            label="Your balance"
            value={connected ? <>{fmtSol(bal, 4)}<span className="text-base ml-1 text-[color:var(--color-muted)]">SOL</span></> : "—"}
            sub={CLUSTER === "devnet" ? "devnet · live" : "mainnet · live"}
          />
        </div>
      </section>

      {/* main grid */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass rounded-2xl p-6 relative overflow-hidden"
            >
              <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-30 bg-[#7c5cff]" />
              <div className="relative flex items-center justify-between mb-6">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
                    Current allocation
                  </div>
                  <div className="text-sm text-[color:var(--color-muted)] mt-0.5">
                    Last rebalance: 4h 12m ago · proof <span className="font-mono text-[color:var(--color-accent-2)]">0x4af…a91</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              </div>
              <AllocationChart />
            </motion.div>

            <ProofFeed />
          </div>

          <aside>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="glass rounded-2xl p-6 sticky top-28"
            >
              <div className="flex gap-1 p-1 bg-black/40 rounded-xl mb-6 border border-[color:var(--color-border)]">
                {(["deposit", "withdraw"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition relative ${
                      tab === t
                        ? "text-white"
                        : "text-[color:var(--color-muted)] hover:text-white"
                    }`}
                  >
                    {tab === t && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#7c5cff] to-[#29d3ff]"
                        transition={{ type: "spring", duration: 0.5 }}
                      />
                    )}
                    <span className="relative inline-flex items-center justify-center gap-1.5">
                      {t === "deposit" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                      {t}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <DepositCard mode={tab} />
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 pt-6 border-t border-[color:var(--color-border)] space-y-3 text-xs">
                <Row k="Cluster" v={<code className="text-[color:var(--color-accent-2)]">{CLUSTER}</code>} />
                <Row k="Strategy commitment" v={<span className="font-mono">0xc0ffee…d00d</span>} />
                <Row k="Approved model" v={<code className="text-[color:var(--color-accent-2)]">atlas-v1</code>} />
                <Row k="Rebalance cooldown" v="4h" />
                <Row k="Withdraw" v={<span className="text-[color:var(--color-success)]">no proof needed</span>} />
              </div>

              {CLUSTER === "devnet" && connected && bal !== null && bal !== undefined && bal < 1e7 && (
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
            </motion.div>
          </aside>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[color:var(--color-muted)]">{k}</span>
      <span>{v}</span>
    </div>
  );
}

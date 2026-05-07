"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ExternalLink, Search } from "lucide-react";
import { Footer } from "@/components/Footer";
import { useState } from "react";

const proofs = Array.from({ length: 12 }).map((_, i) => ({
  slot: 298_412_180 - i * 14_400,
  ts: `${4 + i * 6}h ago`,
  hash: `0x${(Math.random() * 1e16).toString(16).slice(0, 4)}…${(Math.random() * 1e16).toString(16).slice(0, 4)}`,
  legs: 3 + (i % 2),
  cu: 720_000 + Math.floor(Math.random() * 80_000),
  proverMs: 28_000 + Math.floor(Math.random() * 8_000),
}));

export default function ProofsPage() {
  const [q, setQ] = useState("");
  const filtered = proofs.filter((p) => String(p.slot).includes(q) || p.hash.includes(q));

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
            <ShieldCheck className="h-3 w-3 text-[color:var(--color-success)]" />
            <span className="text-[color:var(--color-muted)]">All rebalances · all proofs · public record</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            Proof <span className="text-gradient">explorer</span>
          </h1>
          <p className="text-[color:var(--color-muted)] max-w-2xl">
            Every Atlas rebalance, the proof that gated it, and the Solscan tx where it
            landed. Cross-check the math yourself.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-6">
        <div className="glass rounded-lg p-3 flex items-center gap-3">
          <Search className="h-4 w-4 text-[color:var(--color-muted)] ml-2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search by slot, proof hash, vault…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <span className="text-xs text-[color:var(--color-muted)]">
            {filtered.length} of {proofs.length}
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="glass rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] border-b border-[color:var(--color-border)]">
                <th className="text-left px-5 py-3 font-medium">Slot</th>
                <th className="text-left px-5 py-3 font-medium">Time</th>
                <th className="text-left px-5 py-3 font-medium">Proof hash</th>
                <th className="text-right px-5 py-3 font-medium">Legs</th>
                <th className="text-right px-5 py-3 font-medium">CU</th>
                <th className="text-right px-5 py-3 font-medium">Prove time</th>
                <th className="text-right px-5 py-3 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {filtered.map((p, i) => (
                <motion.tr
                  key={p.slot}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-white/5 transition"
                >
                  <td className="px-5 py-3 font-mono text-xs">{p.slot.toLocaleString()}</td>
                  <td className="px-5 py-3 text-[color:var(--color-muted)]">{p.ts}</td>
                  <td className="px-5 py-3 font-mono text-xs text-[color:var(--color-accent-2)]">{p.hash}</td>
                  <td className="px-5 py-3 text-right">{p.legs}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs">{(p.cu / 1000).toFixed(0)}k</td>
                  <td className="px-5 py-3 text-right font-mono text-xs">{(p.proverMs / 1000).toFixed(1)}s</td>
                  <td className="px-5 py-3 text-right">
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 text-xs text-[color:var(--color-accent)] hover:underline"
                    >
                      view <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Footer />
    </main>
  );
}

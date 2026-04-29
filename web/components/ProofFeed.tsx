"use client";

import { motion } from "framer-motion";
import { ExternalLink, ShieldCheck } from "lucide-react";

const proofs = [
  { slot: "298_412_180", time: "4h 12m ago", hash: "0x4af2…a91d", tx: "5xK7…vQbA", legs: 4 },
  { slot: "298_396_055", time: "10h 8m ago", hash: "0xb014…13f9", tx: "8gPm…L2zX", legs: 4 },
  { slot: "298_381_902", time: "16h 4m ago", hash: "0x2f80…ec55", tx: "Q1aU…RnM4", legs: 3 },
  { slot: "298_367_741", time: "22h 1m ago", hash: "0xff50…0a17", tx: "Hc9V…wErB", legs: 4 },
  { slot: "298_353_488", time: "1d 3h ago", hash: "0x711d…b8e2", tx: "Ko4n…J7tM", legs: 4 },
];

export function ProofFeed() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[color:var(--color-success)]" />
            Verified rebalances
          </h2>
          <div className="text-xs text-[color:var(--color-muted)] mt-0.5">
            Every entry reflects an SP1 proof landed onchain
          </div>
        </div>
        <span className="text-xs font-mono text-[color:var(--color-muted)] hidden md:inline">
          SP1 → Groth16 → alt_bn128
        </span>
      </div>

      <ul className="divide-y divide-[color:var(--color-border)]">
        {proofs.map((p, i) => (
          <motion.li
            key={p.slot}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
            className="py-3 flex items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] flex-shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  Rebalance · {p.legs} legs
                </div>
                <div className="text-xs text-[color:var(--color-muted)] flex items-center gap-2 font-mono">
                  <span>slot {p.slot}</span>
                  <span>·</span>
                  <span>{p.time}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs font-mono text-[color:var(--color-muted)] hidden md:inline">
                {p.hash}
              </span>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-xs text-[color:var(--color-accent)] hover:underline"
              >
                Solscan <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

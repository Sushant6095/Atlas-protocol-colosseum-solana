"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletPicker } from "@/components/WalletPickerModal";
import { Wallet, ChevronDown, LogOut, Copy, Check } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ConnectButton() {
  const { publicKey, disconnect, connecting, connected, wallet } = useWallet();
  const setPickerOpen = useWalletPicker((s) => s.setOpen);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setPickerOpen(true)}
        disabled={connecting}
        className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] px-5 py-2.5 text-white text-sm font-medium glow-accent hover:opacity-95 transition disabled:opacity-50"
      >
        <Wallet className="h-4 w-4" />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  const addr = publicKey.toBase58();
  const short = `${addr.slice(0, 4)}…${addr.slice(-4)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl glass px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition"
      >
        <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)] animate-pulse" />
        {wallet?.adapter.icon && (
          <img src={wallet.adapter.icon} alt="" className="h-4 w-4 rounded" />
        )}
        <span className="font-mono">{short}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 glass rounded-xl p-2 z-50"
          >
            <div className="px-3 py-2 text-xs text-[color:var(--color-muted)]">Connected to</div>
            <div className="px-3 pb-3 font-mono text-xs break-all">{addr}</div>
            <div className="border-t border-[color:var(--color-border)] pt-1">
              <button
                onClick={copy}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm"
              >
                {copied ? <Check className="h-4 w-4 text-[color:var(--color-success)]" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy address"}
              </button>
              <button
                onClick={() => { setOpen(false); disconnect(); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-[color:#ff5c5c]"
              >
                <LogOut className="h-4 w-4" /> Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

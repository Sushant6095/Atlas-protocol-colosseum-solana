"use client";

import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import { create } from "zustand";

interface ModalStore {
  open: boolean;
  setOpen: (v: boolean) => void;
}
export const useWalletPicker = create<ModalStore>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
}));

interface Choice {
  name: string;
  /** Names the wallet-adapter `select()` accepts. Phantom/Solflare/Backpack
   *  are registered via the Solana Wallet Standard, so the adapter picks
   *  them up automatically when the extension is installed. */
  adapterNames: string[];
  /** Where to send users that don't have it installed. */
  installUrl: string;
  iconBg: string;
  /** Inline SVG so the row paints instantly without a network round-trip. */
  iconSvg: JSX.Element;
}

const CHOICES: Choice[] = [
  {
    name: "Phantom",
    adapterNames: ["Phantom"],
    installUrl: "https://phantom.app/download",
    iconBg: "linear-gradient(180deg, #ab9ff2 0%, #534bb1 100%)",
    iconSvg: (
      <svg viewBox="0 0 128 128" width={20} height={20} aria-hidden>
        <path
          fill="#fff"
          d="M93 47c4 0 7 3 7 7v6c0 9-7 17-16 17h-7c0 11-9 21-21 21H35c-11 0-20-9-20-21 0-26 21-47 47-47h31zM52 60c-3 0-5 3-5 7s2 7 5 7c2 0 4-3 4-7s-2-7-4-7zm17 0c-2 0-4 3-4 7s2 7 4 7c3 0 5-3 5-7s-2-7-5-7z"
        />
      </svg>
    ),
  },
  {
    name: "Solflare",
    adapterNames: ["Solflare"],
    installUrl: "https://solflare.com/download",
    iconBg: "linear-gradient(180deg, #ffd45f 0%, #f59c1a 100%)",
    iconSvg: (
      <svg viewBox="0 0 64 64" width={20} height={20} aria-hidden>
        <circle cx="32" cy="32" r="14" fill="#fff" />
        <g stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <line x1="32" y1="6"  x2="32" y2="14" />
          <line x1="32" y1="50" x2="32" y2="58" />
          <line x1="6"  y1="32" x2="14" y2="32" />
          <line x1="50" y1="32" x2="58" y2="32" />
          <line x1="13" y1="13" x2="19" y2="19" />
          <line x1="45" y1="45" x2="51" y2="51" />
          <line x1="13" y1="51" x2="19" y2="45" />
          <line x1="45" y1="19" x2="51" y2="13" />
        </g>
      </svg>
    ),
  },
  {
    name: "MetaMask",
    // MetaMask doesn't sign Solana txs natively — Atlas links to the
    // Solflare-maintained Solana Snap instead so MetaMask users can
    // sign Solana from desktop MetaMask.
    adapterNames: [],
    installUrl: "https://snaps.metamask.io/snap/npm/solflare-wallet/solana-snap/",
    iconBg: "linear-gradient(180deg, #f6851b 0%, #e4761b 100%)",
    iconSvg: (
      <svg viewBox="0 0 32 32" width={20} height={20} aria-hidden>
        <path fill="#fff" d="M16 4 L9 9 V14 L4 17 L7 22 L11 21 L13 24 H19 L21 21 L25 22 L28 17 L23 14 V9 Z" />
      </svg>
    ),
  },
  {
    name: "Backpack",
    adapterNames: ["Backpack"],
    installUrl: "https://backpack.app/downloads",
    iconBg: "linear-gradient(180deg, #ff5c5c 0%, #e63946 100%)",
    iconSvg: (
      <svg viewBox="0 0 32 32" width={20} height={20} aria-hidden>
        <rect x="6" y="10" width="20" height="18" rx="3" fill="#fff" />
        <path fill="#fff" d="M11 6c0-2 1-3 2-3h6c1 0 2 1 2 3v4h-2V7h-6v3h-2z" />
      </svg>
    ),
  },
];

export function WalletPickerModal(): JSX.Element {
  const { open, setOpen } = useWalletPicker();
  const { wallets, select, connect } = useWallet();

  const handlePick = async (choice: Choice): Promise<void> => {
    // Find a registered adapter whose name matches one of the choice's
    // accepted names. Wallet Standard registration runs at provider
    // mount, so this walks the live wallet list.
    const match: Wallet | undefined = wallets.find((w) =>
      choice.adapterNames.includes(w.adapter.name),
    );

    if (!match) {
      // Not installed (or no adapter for it, e.g. MetaMask) — send the
      // user to the install / snap URL in a new tab.
      window.open(choice.installUrl, "_blank", "noopener,noreferrer");
      return;
    }

    select(match.adapter.name);
    setOpen(false);
    // Small tick so the provider commits the new selection before
    // we kick off the connect flow.
    await new Promise((r) => setTimeout(r, 50));
    try { await connect(); } catch { /* user dismissed */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-picker-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-2xl px-6 py-6"
            style={{
              background: "#0a0a0c",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3
                id="wallet-picker-title"
                className="text-[13px] font-medium tracking-[0.18em] uppercase text-white/95"
              >
                Connect wallet
              </h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-white/60 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {CHOICES.map((c) => {
                const detected = wallets.some((w) => c.adapterNames.includes(w.adapter.name));
                const installable = c.adapterNames.length > 0 && !detected;
                return (
                  <button
                    key={c.name}
                    onClick={() => void handlePick(c)}
                    className="group flex items-center gap-3 w-full rounded-full px-4 py-3
                               text-left transition border"
                    style={{
                      background: "#101013",
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
                  >
                    <span
                      className="grid place-items-center h-7 w-7 rounded-full flex-none"
                      style={{ background: c.iconBg }}
                    >
                      {c.iconSvg}
                    </span>
                    <span className="text-[15px] font-medium text-white flex-1">
                      {c.name}
                    </span>
                    {detected && (
                      <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-400/90">
                        detected
                      </span>
                    )}
                    {installable && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-white/50 group-hover:text-white/80 transition">
                        install <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                    {c.adapterNames.length === 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-white/50 group-hover:text-white/80 transition">
                        snap <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-[11px] leading-relaxed text-white/45">
              Connecting only requests a signature — no transactions are sent.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

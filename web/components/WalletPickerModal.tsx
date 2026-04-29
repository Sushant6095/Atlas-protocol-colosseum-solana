"use client";

import { useWallet, type Wallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, QrCode, Smartphone, X } from "lucide-react";
import { create } from "zustand";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface ModalStore {
  open: boolean;
  setOpen: (v: boolean) => void;
}
export const useWalletPicker = create<ModalStore>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
}));

type Tab = "extension" | "mobile";

export function WalletPickerModal() {
  const { open, setOpen } = useWalletPicker();
  const { wallets, select, connect } = useWallet();
  const [tab, setTab] = useState<Tab>("extension");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const installed = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );
  const others = wallets.filter(
    (w) => w.readyState === WalletReadyState.NotDetected || w.readyState === WalletReadyState.Unsupported,
  );

  const handleSelect = async (w: Wallet) => {
    select(w.adapter.name);
    setOpen(false);
    try {
      await new Promise((r) => setTimeout(r, 50));
      await connect().catch(() => {});
    } catch {}
  };

  // Phantom universal link — opens dapp inside Phantom mobile in-app browser
  const phantomDeepLink = origin
    ? `https://phantom.app/ul/browse/${encodeURIComponent(origin)}?ref=${encodeURIComponent(origin)}`
    : "";
  const solflareDeepLink = origin
    ? `https://solflare.com/ul/v1/browse/${encodeURIComponent(origin)}?ref=${encodeURIComponent(origin)}`
    : "";
  const [activeQr, setActiveQr] = useState<"phantom" | "solflare">("phantom");
  const qrUrl = activeQr === "phantom" ? phantomDeepLink : solflareDeepLink;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md glass rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Connect a wallet</h3>
                <p className="text-xs text-[color:var(--color-muted)] mt-1">
                  Pick any Solana wallet, or scan a QR for mobile.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[color:var(--color-muted)] hover:text-white" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* tab pills */}
            <div className="flex gap-1 p-1 bg-black/40 rounded-xl mb-4 border border-[color:var(--color-border)]">
              {([
                { k: "extension", label: "Browser", icon: <ExternalLink className="h-3.5 w-3.5" /> },
                { k: "mobile", label: "Mobile QR", icon: <QrCode className="h-3.5 w-3.5" /> },
              ] as const).map(({ k, label, icon }) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition relative inline-flex items-center justify-center gap-1.5 ${
                    tab === k ? "text-white" : "text-[color:var(--color-muted)]"
                  }`}
                >
                  {tab === k && (
                    <motion.span
                      layoutId="picker-tab"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#7c5cff] to-[#29d3ff]"
                      transition={{ type: "spring", duration: 0.4 }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">{icon}{label}</span>
                </button>
              ))}
            </div>

            {tab === "extension" && (
              <ExtensionTab installed={installed} others={others} onSelect={handleSelect} />
            )}

            {tab === "mobile" && (
              <MobileTab
                qrUrl={qrUrl}
                active={activeQr}
                setActive={setActiveQr}
              />
            )}

            <div className="text-[11px] text-[color:var(--color-muted)] mt-5 leading-relaxed">
              Connecting only requests a signature — no transactions are sent.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ExtensionTab({
  installed,
  others,
  onSelect,
}: {
  installed: Wallet[];
  others: Wallet[];
  onSelect: (w: Wallet) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        {installed.length === 0 && (
          <div className="text-xs text-[color:var(--color-muted)] py-2">
            No Solana wallets detected in this browser.
          </div>
        )}
        {installed.map((w) => (
          <WalletRow key={w.adapter.name} wallet={w} onClick={() => onSelect(w)} />
        ))}
      </div>

      {others.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-widest text-[color:var(--color-muted)] mt-5 mb-2">
            Not installed
          </div>
          <div className="space-y-2">
            {others.map((w) => (
              <a
                key={w.adapter.name}
                href={w.adapter.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between w-full rounded-xl border border-[color:var(--color-border)] px-3 py-3 hover:bg-white/5 transition"
              >
                <span className="flex items-center gap-3 text-sm">
                  <img src={w.adapter.icon} alt="" className="h-6 w-6 rounded" />
                  {w.adapter.name}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)]">
                  Install <ExternalLink className="h-3 w-3" />
                </span>
              </a>
            ))}
          </div>
        </>
      )}

      {/* MetaMask Solana Snap hint */}
      <div className="mt-5 rounded-xl border border-[color:var(--color-border)] bg-black/30 p-3">
        <div className="flex items-start gap-3">
          <img
            src="https://metamask.io/images/metamask-fox.svg"
            alt="MetaMask"
            className="h-7 w-7 mt-0.5"
          />
          <div className="flex-1">
            <div className="text-sm font-medium">MetaMask</div>
            <div className="text-xs text-[color:var(--color-muted)] mt-0.5 leading-relaxed">
              Use MetaMask on Solana via the official Snap. Once installed it appears here as a detected wallet.
            </div>
            <a
              href="https://snaps.metamask.io/snap/npm/solflare-wallet/solana-snap/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-[color:var(--color-accent)] hover:underline"
            >
              Install Solana Snap <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function MobileTab({
  qrUrl,
  active,
  setActive,
}: {
  qrUrl: string;
  active: "phantom" | "solflare";
  setActive: (v: "phantom" | "solflare") => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["phantom", "solflare"] as const).map((w) => (
          <button
            key={w}
            onClick={() => setActive(w)}
            className={`flex-1 py-2 rounded-lg text-sm capitalize border transition ${
              active === w
                ? "border-[color:var(--color-accent)] bg-white/5 text-white"
                : "border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:bg-white/5"
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div className="rounded-2xl bg-white p-4">
          {qrUrl ? (
            <QRCodeSVG value={qrUrl} size={200} bgColor="#ffffff" fgColor="#06060a" level="M" includeMargin={false} />
          ) : (
            <div className="h-[200px] w-[200px] flex items-center justify-center text-xs text-black">Loading…</div>
          )}
        </div>
        <div className="text-center text-xs text-[color:var(--color-muted)] max-w-xs leading-relaxed">
          <Smartphone className="inline h-3 w-3 mr-1" />
          Open the {active === "phantom" ? "Phantom" : "Solflare"} app on your phone and scan. The dapp opens inside the wallet&apos;s in-app browser.
        </div>
      </div>
    </div>
  );
}

function WalletRow({ wallet, onClick }: { wallet: Wallet; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full rounded-xl border border-[color:var(--color-border)] bg-black/30 px-3 py-3 hover:border-[color:var(--color-accent)] hover:bg-white/5 transition group"
    >
      <span className="flex items-center gap-3 text-sm font-medium">
        <img src={wallet.adapter.icon} alt="" className="h-7 w-7 rounded" />
        {wallet.adapter.name}
      </span>
      <span className="text-xs text-[color:var(--color-success)] group-hover:text-white transition">
        Detected →
      </span>
    </button>
  );
}

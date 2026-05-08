// <WalletButton> — presentational connect/connected control.
//
// Headless: takes pubkey + handlers, doesn't bind to a specific
// wallet adapter. Lets the host app (atlas/web) keep its
// useWallet() integration while the same shape works on
// app.atlasfi.in / dev.atlasfi.in.
//
// Two states:
//   - disconnected: gradient pill, "Connect Wallet"
//   - connected:    glass pill, dot + short addr + chevron, click
//                   reveals copy + disconnect dropdown.

"use client";

import { useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy, Check } from "lucide-react";
import { cn } from "./cn";

export interface WalletButtonProps {
  pubkey?: string;
  connecting?: boolean;
  walletIconUrl?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

export function WalletButton({
  pubkey, connecting, walletIconUrl, onConnect, onDisconnect, className,
}: WalletButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!pubkey) {
    return (
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
        className={cn(
          "group inline-flex items-center gap-2 rounded-[var(--radius-md)]",
          "px-4 py-2 text-[13px] font-medium text-white",
          "bg-[linear-gradient(90deg,var(--color-accent-zk),var(--color-accent-electric))]",
          "shadow-[0_0_24px_rgba(46,160,255,0.20)]",
          "hover:opacity-95 transition disabled:opacity-50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)]",
          className,
        )}
      >
        <Wallet className="h-4 w-4" />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  const short = `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;

  async function copy(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(pubkey!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--radius-md)] border",
          "px-3 py-2 text-[13px] font-medium",
          "transition-colors hover:bg-[color:var(--color-surface-raised)]",
        )}
        style={{
          borderColor: "var(--color-line-soft)",
          background: "var(--color-surface-base)",
          color: "var(--color-ink-primary)",
        }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-accent-execute)" }} />
        {walletIconUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={walletIconUrl} alt="" className="h-4 w-4 rounded" />
        )}
        <span className="font-mono">{short}</span>
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-[var(--radius-md)] border p-2 z-50"
          style={{
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-line-medium)",
          }}
        >
          <div className="px-3 py-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-ink-tertiary)" }}>
            Connected to
          </div>
          <div className="px-3 pb-2 font-mono text-[11px] break-all" style={{ color: "var(--color-ink-secondary)" }}>
            {pubkey}
          </div>
          <div className="border-t pt-1" style={{ borderColor: "var(--color-line-soft)" }}>
            <button
              type="button"
              onClick={copy}
              className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-[13px] hover:bg-[color:var(--color-surface-base)]"
              style={{ color: "var(--color-ink-primary)" }}
            >
              {copied ? <Check className="h-4 w-4" style={{ color: "var(--color-accent-execute)" }} /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy address"}
            </button>
            {onDisconnect && (
              <button
                type="button"
                onClick={() => { setOpen(false); onDisconnect(); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)] text-[13px] hover:bg-[color:var(--color-surface-base)]"
                style={{ color: "var(--color-accent-danger)" }}
              >
                <LogOut className="h-4 w-4" /> Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

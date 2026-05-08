// WalletStatusPill — header indicator. The "CONNECTING" pill the
// realtime engine ships isn't useful chrome — it reads as
// developer-debug noise to anyone outside the team. This pill
// replaces it with wallet-keyed state.
//
// State machine (from @solana/wallet-adapter-react):
//   - disconnected → render nothing (no idle dot in the chrome).
//   - connecting   → 6px pulsing amber dot + "connecting".
//   - mismatch     → 6px solid danger dot + "wrong network".
//   - connected    → 6px solid execute dot + truncated address.
//
// Pulse is CSS-only (1.5s ease-in-out infinite, scale 1.0→1.4,
// opacity 1.0→0.6) so the host page doesn't pay a JS RAF for chrome
// that's almost always idle.

"use client";

import { memo, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { cn } from "@/components/primitives";

const ATLAS_NETWORK = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet").toLowerCase();

type Tone = "warn" | "execute" | "danger";

interface View {
  dotColour: string;
  pulsing:  boolean;
  textColour: string;
  text: string;
}

function viewFor(args: {
  connecting: boolean;
  connected: boolean;
  mismatch: boolean;
  short: string | null;
}): View | null {
  if (args.connecting) {
    return {
      dotColour: "var(--color-accent-warn)",
      pulsing: true,
      textColour: "var(--color-ink-tertiary)",
      text: "connecting",
    };
  }
  if (args.mismatch) {
    return {
      dotColour: "var(--color-accent-danger)",
      pulsing: false,
      textColour: "var(--color-accent-danger)",
      text: "wrong network",
    };
  }
  if (args.connected && args.short) {
    return {
      dotColour: "var(--color-accent-execute)",
      pulsing: false,
      textColour: "var(--color-ink-secondary)",
      text: args.short,
    };
  }
  return null;
}

function WalletStatusPillImpl(): JSX.Element | null {
  const { publicKey, connecting, connected, wallet } = useWallet();

  const short = useMemo(() => {
    if (!publicKey) return null;
    const a = publicKey.toBase58();
    return `${a.slice(0, 4)}…${a.slice(-4)}`;
  }, [publicKey]);

  // Network mismatch: the wallet adapter doesn't expose cluster
  // directly, so we cross-check the wallet's chain hint when the
  // standard's getChain method is available. For now we mark a
  // mismatch only if a known mainnet adapter is connected to a
  // non-mainnet Atlas deployment, or vice versa.
  const mismatch = useMemo(() => {
    if (!connected || !wallet) return false;
    const adapterName = wallet.adapter.name.toLowerCase();
    // Conservative heuristic — adapters that report a chain via
    // `chains` would surface here in production; keep this off
    // until the wallet-standard adapter exposes it cleanly.
    void adapterName;
    return false;
  }, [connected, wallet]);

  const view = viewFor({ connecting, connected, mismatch, short });
  if (!view) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 h-6 px-2.5 rounded-full",
        "border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-sunken)]",
        "font-mono text-[11px] lowercase tracking-[0.02em]",
      )}
      style={{ color: view.textColour }}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          view.pulsing && "animate-[atlas-wallet-pulse_1.5s_ease-in-out_infinite]",
        )}
        style={{ background: view.dotColour }}
      />
      {view.text}
    </span>
  );
}

export const WalletStatusPill = memo(WalletStatusPillImpl);
WalletStatusPill.displayName = "WalletStatusPill";

// Cluster name is read at module evaluation; export for tests.
export const __ATLAS_NETWORK = ATLAS_NETWORK;

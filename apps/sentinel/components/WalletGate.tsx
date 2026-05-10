"use client";

// Solflare-first wallet connect. Wallet-standard means any wallet
// in the user's browser (Phantom, Backpack, etc.) also works, but
// Solflare is the default modal entry per the partner integration.
//
// Phase 0 mocks the connected state via local component state so
// the UI is testable without the real adapter. Phase 1 will wire
// @solana/wallet-adapter-react's useWallet().

import { useEffect, useRef, useState } from "react";
import { Check, Copy, LogOut, Wallet } from "lucide-react";

function truncate(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

const DEMO_ADDR = "HapvfRA4BoqUxz7N1MXsxwLDhSDhbqsE82PAs1Svnnwj";

export function WalletGate() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function connect() {
    // Phase 1: replace with real Solflare adapter:
    //   const { wallet, connect } = useWallet();
    //   await connect();
    setAddress(DEMO_ADDR);
    setConnected(true);
  }

  function disconnect() {
    setConnected(false);
    setAddress(null);
    setMenuOpen(false);
  }

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard denied */
    }
  }

  if (!connected || !address) {
    return (
      <button
        type="button"
        onClick={connect}
        className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-opacity hover:opacity-90"
        style={{
          background: "var(--color-accent-execute)",
          color: "var(--color-surface-base)",
        }}
      >
        <Wallet className="h-4 w-4" />
        Connect Solflare
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3 font-mono text-xs tabular-nums transition-colors"
        style={{
          borderColor: "var(--color-line-medium)",
          background: "var(--color-surface-raised)",
          color: "var(--color-ink-primary)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--color-accent-execute)" }}
        />
        {truncate(address)}
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-md border p-2 shadow-xl"
          style={{
            borderColor: "var(--color-line-medium)",
            background: "var(--color-surface-raised)",
          }}
        >
          <p
            className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            Connected
          </p>
          <p
            className="px-2 pb-2 font-mono text-[11px] break-all"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            {address}
          </p>
          <div className="border-t pt-1" style={{ borderColor: "var(--color-line-soft)" }}>
            <button
              onClick={copy}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-[color:var(--color-surface-base)]"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy address"}
            </button>
            <button
              onClick={disconnect}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-[color:var(--color-surface-base)]"
              style={{ color: "var(--color-accent-danger)" }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

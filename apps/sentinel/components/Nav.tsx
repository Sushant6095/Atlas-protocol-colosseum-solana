"use client";

import Link from "next/link";
import { WalletGate } from "./WalletGate";

export function Nav() {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{
        borderColor: "var(--color-line-soft)",
        background: "color-mix(in oklab, var(--color-surface-base) 80%, transparent)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--color-accent-execute)" }}
          />
          Sentinel
        </Link>

        <a
          href="https://atlasfi.in"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] font-mono transition-colors hover:opacity-90"
          style={{
            borderColor: "color-mix(in oklab, var(--color-accent-zk) 35%, transparent)",
            color: "var(--color-accent-zk)",
            background: "color-mix(in oklab, var(--color-accent-zk) 8%, transparent)",
          }}
        >
          Powered by Atlas Protocol ↗
        </a>

        <div className="ml-auto">
          <WalletGate />
        </div>
      </div>
    </header>
  );
}

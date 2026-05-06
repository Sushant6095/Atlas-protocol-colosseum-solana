"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletPickerModal } from "@/components/WalletPickerModal";
import { createQueryClient } from "@/lib/state";
import { initRealtime } from "@/lib/realtime";
import { CommandPalette, KeyboardShortcuts } from "@/components/command-palette";
import { AlertCenter } from "@/components/system";
import { useSessionStore } from "@/lib/auth";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => createQueryClient());

  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL ?? clusterApiUrl("devnet"),
    [],
  );

  // Solflare highlighted as the launch partner per Phase 09 §5.
  const wallets = useMemo(() => {
    const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    const list: unknown[] = [
      new SolflareWalletAdapter(),
      new PhantomWalletAdapter(),
    ];
    if (wcId) {
      list.push(
        new WalletConnectWalletAdapter({
          network:
            (process.env.NEXT_PUBLIC_CLUSTER as WalletAdapterNetwork) ??
            WalletAdapterNetwork.Devnet,
          options: {
            projectId: wcId,
            metadata: {
              name: "Atlas",
              description: "Verifiable AI DeFi for Solana",
              url:
                typeof window !== "undefined"
                  ? window.location.origin
                  : "https://atlas.fyi",
              icons: [
                typeof window !== "undefined"
                  ? `${window.location.origin}/favicon.ico`
                  : "https://atlas.fyi/favicon.ico",
              ],
            },
          },
        }) as unknown,
      );
    }
    return list;
  }, []);

  // Bootstrap realtime + session on mount.
  useEffect(() => {
    void hydrateSession();
    const wsUrl =
      process.env.NEXT_PUBLIC_ATLAS_WS_URL
      ?? (typeof window !== "undefined"
            ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/v1/stream`
            : null);
    if (wsUrl) initRealtime({ url: wsUrl });
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider
          wallets={wallets as never[]}
          autoConnect={false}
          onError={(e) => console.warn("[wallet]", e?.message ?? e)}
        >
          {children}
          <WalletPickerModal />
          <CommandPalette />
          <AlertCenter />
          <KeyboardShortcuts />
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}

async function hydrateSession() {
  try {
    const r = await fetch("/api/v1/auth/session", { credentials: "include" });
    if (!r.ok) return;
    const s = (await r.json()) as {
      wallet: string | null;
      scopes: string[];
      expires_at: number;
      jwt: string | null;
    };
    useSessionStore.getState().setSession({
      claims: { wallet: s.wallet, scopes: s.scopes as never, expires_at: s.expires_at },
      jwt: s.jwt,
    });
  } catch {
    // No session — store stays anon.
  }
}

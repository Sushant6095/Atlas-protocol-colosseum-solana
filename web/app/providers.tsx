"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletConnectWalletAdapter } from "@solana/wallet-adapter-walletconnect";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletPickerModal } from "@/components/WalletPickerModal";

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));

  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL ?? clusterApiUrl("devnet"),
    [],
  );

  const wallets = useMemo(
    () => {
      const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      const list: any[] = [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
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
          }),
        );
      }
      return list;
    },
    [],
  );

  return (
    <QueryClientProvider client={qc}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider
          wallets={wallets}
          autoConnect={false}
          onError={(e) => console.warn("[wallet]", e?.message ?? e)}
        >
          {children}
          <WalletPickerModal />
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}

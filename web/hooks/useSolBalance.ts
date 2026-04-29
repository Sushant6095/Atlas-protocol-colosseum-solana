"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";

export function useSolBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ["sol-balance", publicKey?.toBase58() ?? null],
    queryFn: async () => {
      if (!publicKey) return null;
      const lamports = await connection.getBalance(publicKey, "confirmed");
      return lamports;
    },
    enabled: !!publicKey,
    refetchInterval: 15_000,
  });
}

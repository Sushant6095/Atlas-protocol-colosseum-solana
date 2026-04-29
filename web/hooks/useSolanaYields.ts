"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSolanaYields, type DLPool } from "@/lib/markets";

export function useSolanaYields() {
  return useQuery<DLPool[]>({
    queryKey: ["solana-yields"],
    queryFn: fetchSolanaYields,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

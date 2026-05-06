// TanStack Query defaults (Phase 20 §6.1).
//
// Atlas uses two `staleTime` profiles: live and archival. Pick at
// the query call site via the helpers below. Suspense mode is
// reserved for top-level page loaders; classic mode for sidecar
// panels (so a slow chart doesn't block the page).

import { QueryClient } from "@tanstack/react-query";

const STALE_LIVE_MS = 5_000;
const STALE_ARCHIVAL_MS = 60_000;
const GC_MS = 5 * 60_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_LIVE_MS,
        gcTime: GC_MS,
        refetchOnWindowFocus: false,
        retry: 2,
      },
      mutations: { retry: 0 },
    },
  });
}

/**
 * Stable selector helper — wraps a `useQuery` config so consumers
 * don't have to remember which `staleTime` to pass.
 */
export function liveQuery<T>(opts: T): T & { staleTime: number } {
  return { ...opts, staleTime: STALE_LIVE_MS };
}

export function archivalQuery<T>(opts: T): T & { staleTime: number } {
  return { ...opts, staleTime: STALE_ARCHIVAL_MS };
}

/** Vault-scoped key prefix. Always include the vault id in keys so
 *  invalidation is explicit, never blanket. */
export function vaultKey(vaultId: string, ...rest: unknown[]): unknown[] {
  return ["vault", vaultId, ...rest];
}

export function infraKey(...rest: unknown[]): unknown[] {
  return ["infra", ...rest];
}

export function intelKey(...rest: unknown[]): unknown[] {
  return ["intel", ...rest];
}

export function perKey(...rest: unknown[]): unknown[] {
  return ["per", ...rest];
}

// Single TanStack Query key factory (Phase 21 §7.2).
//
// Every query in the app produces its key from this file. Scoped
// invalidation comes for free — `queryClient.invalidateQueries({
// queryKey: queryKeys.vault(id).rebalances() })` invalidates one
// vault's rebalance lists without touching other vaults.
//
// Adding a key: extend the relevant builder + use the `vaultKey /
// infraKey / intelKey / perKey` prefixes from `lib/state` so nothing
// here is anchored on a string literal.

import { vaultKey, infraKey, intelKey, perKey } from "../state";

type RebalanceWindow = { from: number; to: number };
type LedgerCursor = { cursor?: string; limit?: number };
type HeatmapWindow = { window: "1h" | "24h" | "7d" };

export const queryKeys = {
  // ─── Vaults ────────────────────────────────────────────────
  vaults: () => ["vaults"] as const,
  vault: (id: string) => ({
    self:        () => vaultKey(id),
    rebalances:  (range?: RebalanceWindow) =>
      vaultKey(id, "rebalances", range ?? null),
    proofs:      () => vaultKey(id, "proofs"),
    agents:      () => vaultKey(id, "agents"),
    privacy:     () => vaultKey(id, "execution_privacy"),
  }),
  rebalance: (publicInputHash: string) =>
    ["rebalance", publicInputHash] as const,
  proofResponse: (publicInputHash: string) =>
    ["rebalance", publicInputHash, "proof"] as const,

  // ─── Treasury ─────────────────────────────────────────────
  treasuries: () => ["treasuries"] as const,
  treasury: (id: string) => ({
    self:     () => ["treasury", id] as const,
    ledger:   (cursor?: LedgerCursor) => ["treasury", id, "ledger", cursor ?? null] as const,
    runway:   () => ["treasury", id, "runway"] as const,
    invoices: () => ["treasury", id, "invoices"] as const,
    payments: () => ["treasury", id, "payments"] as const,
    pending:  () => ["treasury", id, "pending"] as const,
    keepers:  () => ["treasury", id, "keepers"] as const,
    confidential: () => ["treasury", id, "confidential"] as const,
    paymentsSchedule: () => ["treasury", id, "payments_schedule"] as const,
    intelligence: () => ["treasury", id, "intelligence"] as const,
    compliance: () => ["treasury", id, "compliance"] as const,
    disclosure: () => ["treasury", id, "disclosure"] as const,
  }),

  // ─── Intelligence ─────────────────────────────────────────
  intel: {
    walletReport: (wallet: string) =>
      intelKey("wallet", wallet),
    heatmap: (range?: HeatmapWindow) =>
      intelKey("heatmap", range ?? null),
    exposureGraph: (wallet: string) =>
      intelKey("exposure", wallet),
    pusd: () => intelKey("pusd"),
  },

  // ─── /infra observatory ───────────────────────────────────
  infra: {
    snapshot:     () => infraKey("snapshot"),
    attribution:  () => infraKey("attribution"),
    freshness:    () => infraKey("freshness"),
    freshnessOne: (vaultId: string) => infraKey("freshness", vaultId),
  },

  // ─── PER (private execution) ──────────────────────────────
  per: {
    sessions:    () => perKey("sessions"),
    session:     (sid: string) => perKey("sessions", sid),
    events:      () => perKey("events"),
  },

  // ─── Execution / Jupiter (Phase 12) ───────────────────────
  triggers:    () => ["triggers"] as const,
  trigger:     (id: string) => ["trigger", id] as const,
  recurring:   (vaultId: string) => ["recurring", vaultId] as const,

  // ─── Operator-agent dashboard ─────────────────────────────
  agents:      () => ["agents"] as const,

  // ─── Governance / models ──────────────────────────────────
  models:      () => ["models"] as const,
  model:       (id: string) => ["model", id] as const,

  // ─── Developer + docs ─────────────────────────────────────
  docs: {
    apiSpec:     () => ["docs", "api-spec"] as const,
    sdkRef:      (lang: "ts" | "rust") => ["docs", "sdk", lang] as const,
    shortcuts:   () => ["docs", "shortcuts"] as const,
  },

  // ─── QVAC privacy notice + alert templates ─────────────────
  qvac: {
    privacyNotice:  () => ["qvac", "privacy"] as const,
    alertTemplates: () => ["qvac", "alert-templates"] as const,
  },

  // ─── Auth session ─────────────────────────────────────────
  auth: {
    session: () => ["auth", "session"] as const,
  },
};

export type QueryKeys = typeof queryKeys;

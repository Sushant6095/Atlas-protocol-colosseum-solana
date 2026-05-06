// Atlas client-state contract (Phase 20 §6).
//
// Three stores, no more:
//
//   1. Server cache: TanStack Query — `useQuery` / `useSuspenseQuery`
//      across `/api/v1/*`. Default `staleTime` is 5_000 ms for live
//      reads, 60_000 ms for archival reads. Query keys include vault
//      id + slot range so invalidation is explicit, never blanket.
//
//   2. Realtime cache: Zustand slice fed by `lib/realtime`.
//      Components subscribe via per-topic selectors; no nested
//      mutation. (See `lib/realtime/store.ts`.)
//
//   3. UI state: Zustand slices for ephemeral interaction state
//      (drawers, modals, palette, vault unlocked state). Each
//      surface owns its slice — no cross-imports.
//
// This file is the registration point: every UI slice declares its
// id here so a dev-mode panel can list active stores. The list is
// also the lint target for the "no orphan store" rule.

export type UiStoreId =
  | "ui.commandPalette"
  | "ui.walletPicker"
  | "ui.vaultUnlock"
  | "ui.drawer"
  | "ui.toast"
  | "ui.intel.heatmapFilter"
  | "ui.terminal.activePane"
  | "ui.per.disclosureKey";

export const REGISTERED_UI_STORES: readonly UiStoreId[] = [
  "ui.commandPalette",
  "ui.walletPicker",
  "ui.vaultUnlock",
  "ui.drawer",
  "ui.toast",
  "ui.intel.heatmapFilter",
  "ui.terminal.activePane",
  "ui.per.disclosureKey",
];

/**
 * Banned store libraries. The list is documentation for code review;
 * runtime enforcement is via the project's package.json + ESLint
 * import rule.
 *
 *   - Redux                   not needed; complexity tax
 *   - Recoil / Jotai          competes with Zustand; pick one
 *   - Context for global      Context is for theme + locale only
 *   - useState lifted up      use the right slice from the start
 */
export const BANNED_STORE_LIBS = [
  "redux",
  "@reduxjs/toolkit",
  "recoil",
  "jotai",
] as const;

// UI state slice (Phase 21 §7.3).
//
// Ephemeral interaction state for shell-level chrome. Per Part 1 §6
// each surface owns its own slice; this file is the cross-cutting
// shell slice (palette, drawers, alert center, right rail).

"use client";

import { create } from "zustand";

interface UiState {
  commandPaletteOpen: boolean;
  alertCenterOpen: boolean;
  rightRailOpen: boolean;
  toggleCommandPalette(): void;
  setCommandPaletteOpen(v: boolean): void;
  toggleAlertCenter(): void;
  setAlertCenterOpen(v: boolean): void;
  toggleRightRail(): void;
}

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  alertCenterOpen:    false,
  rightRailOpen:      true,
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  toggleAlertCenter: () =>
    set((s) => ({ alertCenterOpen: !s.alertCenterOpen })),
  setAlertCenterOpen: (v) => set({ alertCenterOpen: v }),
  toggleRightRail: () => set((s) => ({ rightRailOpen: !s.rightRailOpen })),
}));

"use client";

import { create } from "zustand";
import {
  addKey,
  getPlaintext,
  isUnlocked,
  listKeys,
  lockVault,
  removeKey,
  unlockVault,
  type StoredViewingKey,
} from "./vault";

export type { StoredViewingKey } from "./vault";

interface VaultUiState {
  unlocked: boolean;
  keys: StoredViewingKey[];
  refresh(): Promise<void>;
  lock(): Promise<void>;
}

export const useViewingKeyVaultUi = create<VaultUiState>((set) => ({
  unlocked: false,
  keys: [],
  async refresh() {
    const keys = await listKeys();
    set({ unlocked: isUnlocked(), keys });
  },
  async lock() {
    await lockVault();
    set({ unlocked: false, keys: [] });
  },
}));

export const viewingKeyVault = {
  unlock: unlockVault,
  lock:   lockVault,
  isUnlocked,
  list:   listKeys,
  add:    addKey,
  remove: removeKey,
  /** Transient — see `getPlaintext` doc in vault.ts. */
  getPlaintext,
};

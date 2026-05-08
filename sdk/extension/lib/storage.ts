// Persistent extension storage (chrome.storage.local).
//
// Atlas-specific keys live here so popup, side panel, content
// overlay, and pre-sign overlay all share one schema.

export interface AllowlistEntry {
  origin: string;
  /** ISO timestamp the user added it. */
  addedAt: string;
  /** Pre-sign overlay enabled for this origin. */
  preSign: boolean;
}

export interface ExtensionSettings {
  baseUrl: string;
  /** Default vault ID the popup reads on launch. */
  defaultVaultId: string;
  theme: "dark" | "light";
}

const KEY_ALLOWLIST = "atlas.allowlist.v1";
const KEY_SETTINGS  = "atlas.settings.v1";

const DEFAULT_SETTINGS: ExtensionSettings = {
  baseUrl: "https://app.atlas.example",
  defaultVaultId: "",
  theme: "dark",
};

function getStore(): chrome.storage.LocalStorageArea | undefined {
  if (typeof chrome === "undefined") return undefined;
  return chrome.storage?.local;
}

export async function getAllowlist(): Promise<AllowlistEntry[]> {
  const store = getStore();
  if (!store) return [];
  const r = await store.get(KEY_ALLOWLIST);
  return (r[KEY_ALLOWLIST] ?? []) as AllowlistEntry[];
}

export async function setAllowlist(entries: AllowlistEntry[]): Promise<void> {
  const store = getStore();
  if (!store) return;
  await store.set({ [KEY_ALLOWLIST]: entries });
}

export async function isAllowed(origin: string): Promise<boolean> {
  const list = await getAllowlist();
  return list.some((e) => e.origin === origin);
}

export async function getSettings(): Promise<ExtensionSettings> {
  const store = getStore();
  if (!store) return DEFAULT_SETTINGS;
  const r = await store.get(KEY_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(r[KEY_SETTINGS] ?? {}) };
}

export async function setSettings(next: Partial<ExtensionSettings>): Promise<void> {
  const store = getStore();
  if (!store) return;
  const cur = await getSettings();
  await store.set({ [KEY_SETTINGS]: { ...cur, ...next } });
}

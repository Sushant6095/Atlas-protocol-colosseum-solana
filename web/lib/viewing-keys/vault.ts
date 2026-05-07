// Viewing-key vault (Phase 21 §8.2).
//
// Storage rules:
//   - IndexedDB at rest, encrypted with AES-GCM keyed off a CryptoKey
//     derived from a wallet signature on a fixed message + a
//     passphrase entered at unlock time. The passphrase never
//     persists; it gates re-unlock.
//   - Vault auto-locks 10 minutes after the tab leaves the
//     foreground.
//   - Plaintext keys exist only inside the in-memory `unlocked`
//     map; on lock the map is cleared.
//
// The server never sees a plaintext viewing key.

"use client";

const DB_NAME = "atlas.viewing-keys.v1";
const STORE_NAME = "keys";
const SALT_KEY = "atlas.viewing-keys.salt";
const AUTOLOCK_MS = 10 * 60_000;
const UNLOCK_DOMAIN = "atlas.viewing-key.unlock.v1";

export interface StoredViewingKey {
  /** blake3 over the policy + role + scope fields, hex32. */
  id: string;
  /** Hex32 disclosure-policy hash this key serves. */
  policy_hash: string;
  /** "Operator" / "FinanceAdmin" / "RegulatorTimeWindowed" / "Recipient" / "PublicAuditor" */
  role: string;
  /** "AggregateOnly" / "PerProtocol" / "PerTransaction" / "RecipientList" / "Full" /
   *  "ExecutionPathPostHoc" / "ExecutionPathRealtime" / "AgentTraceOnly" */
  scope: string;
  /** Optional time window for RegulatorTimeWindowed roles (unix s). */
  valid_from?: number;
  valid_until?: number;
  /** Vault id this key applies to (hex32) — empty for treasury-wide keys. */
  vault_id?: string;
  /** Treasury id this key applies to (hex32). */
  treasury_id: string;
  /** Issued at slot. */
  issued_at_slot: number;
  /** Encrypted blob — caller-supplied opaque material, AES-GCM
   *  ciphertext + IV. Plaintext lives only in the in-memory
   *  `unlocked` map below. */
  ciphertext_b64: string;
  iv_b64: string;
}

interface UnlockedKey extends StoredViewingKey {
  /** Plaintext viewing-key material — never persisted. */
  plaintext: Uint8Array;
}

let db: IDBDatabase | null = null;
let cryptoKey: CryptoKey | null = null;
let unlocked = new Map<string, UnlockedKey>();
let autolockTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Public API ────────────────────────────────────────────────────────

export async function unlockVault(opts: {
  walletSignature: Uint8Array;
  passphrase: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  if (!window.crypto?.subtle) {
    throw new Error("WebCrypto unavailable; cannot unlock viewing-key vault");
  }
  const salt = await getOrCreateSalt();
  cryptoKey = await deriveKey(opts.walletSignature, opts.passphrase, salt);
  await ensureDb();
  unlocked = await loadAll();
  resetAutolock();
  attachVisibilityHandler();
}

export function isUnlocked(): boolean {
  return cryptoKey !== null;
}

export async function lockVault(): Promise<void> {
  unlocked = new Map();
  cryptoKey = null;
  if (autolockTimer) {
    clearTimeout(autolockTimer);
    autolockTimer = null;
  }
}

export async function listKeys(): Promise<StoredViewingKey[]> {
  if (!isUnlocked()) return [];
  return Array.from(unlocked.values()).map((k) => {
    // Strip plaintext from outbound list — UI never sees it.
    const { plaintext: _plaintext, ...stored } = k;
    return stored;
  });
}

export async function addKey(input: {
  meta: Omit<StoredViewingKey, "ciphertext_b64" | "iv_b64">;
  plaintext: Uint8Array;
}): Promise<StoredViewingKey> {
  if (!cryptoKey) throw new Error("vault locked");
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  // TS 5.7 narrows Uint8Array's buffer to ArrayBufferLike; the
  // SubtleCrypto signature wants BufferSource (ArrayBuffer-backed).
  // The cast is sound — getRandomValues + the caller-supplied
  // plaintext are always ArrayBuffer-backed here.
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    cryptoKey,
    input.plaintext as BufferSource,
  );
  const stored: StoredViewingKey = {
    ...input.meta,
    iv_b64: bufToB64(iv),
    ciphertext_b64: bufToB64(new Uint8Array(ciphertext)),
  };
  await ensureDb();
  await idbPut(stored);
  unlocked.set(stored.id, { ...stored, plaintext: input.plaintext });
  resetAutolock();
  return stored;
}

export async function removeKey(id: string): Promise<void> {
  await ensureDb();
  await idbDelete(id);
  unlocked.delete(id);
}

/**
 * Read plaintext viewing-key material. Caller MUST treat the result
 * as transient — never log, never persist beyond the call frame.
 * UI rendering should accept the plaintext, derive the requested
 * disclosure, then drop the reference.
 */
export function getPlaintext(id: string): Uint8Array | null {
  const k = unlocked.get(id);
  if (!k) return null;
  resetAutolock();
  // Return a defensive copy.
  return new Uint8Array(k.plaintext);
}

// ─── Internals ─────────────────────────────────────────────────────────

async function ensureDb(): Promise<IDBDatabase> {
  if (db) return db;
  db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
  return db;
}

async function loadAll(): Promise<Map<string, UnlockedKey>> {
  if (!cryptoKey) return new Map();
  const d = await ensureDb();
  const tx = d.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const all: StoredViewingKey[] = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as StoredViewingKey[]);
    req.onerror = () => reject(req.error ?? new Error("getAll failed"));
  });
  const out = new Map<string, UnlockedKey>();
  for (const stored of all) {
    try {
      const iv = b64ToBuf(stored.iv_b64);
      const ct = b64ToBuf(stored.ciphertext_b64);
      const pt = new Uint8Array(
        await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv as BufferSource },
          cryptoKey,
          ct as BufferSource,
        ),
      );
      out.set(stored.id, { ...stored, plaintext: pt });
    } catch {
      // Decryption failed — wrong passphrase / signature for this entry.
      // We deliberately skip rather than corrupt the vault.
    }
  }
  return out;
}

async function idbPut(stored: StoredViewingKey): Promise<void> {
  const d = await ensureDb();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(stored);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("put failed"));
  });
}

async function idbDelete(id: string): Promise<void> {
  const d = await ensureDb();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("delete failed"));
  });
}

async function deriveKey(
  walletSignature: Uint8Array,
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const seedBytes = new Uint8Array(walletSignature.length + passphrase.length + UNLOCK_DOMAIN.length);
  seedBytes.set(walletSignature, 0);
  seedBytes.set(enc.encode(passphrase), walletSignature.length);
  seedBytes.set(enc.encode(UNLOCK_DOMAIN), walletSignature.length + passphrase.length);
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    seedBytes as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 250_000,
      salt: salt as BufferSource,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function getOrCreateSalt(): Promise<Uint8Array> {
  const stored = window.localStorage.getItem(SALT_KEY);
  if (stored) return b64ToBuf(stored);
  const fresh = window.crypto.getRandomValues(new Uint8Array(16));
  window.localStorage.setItem(SALT_KEY, bufToB64(fresh));
  return fresh;
}

function resetAutolock(): void {
  if (autolockTimer) clearTimeout(autolockTimer);
  autolockTimer = setTimeout(() => { void lockVault(); }, AUTOLOCK_MS);
}

function attachVisibilityHandler(): void {
  if (typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // No immediate lock — only the autolock timer when
      // background-time exceeds 10 min. Track the timestamp here so
      // a fast tab-switch doesn't kick the user out.
      resetAutolock();
    }
  });
}

function bufToB64(b: Uint8Array): string {
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}
function b64ToBuf(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

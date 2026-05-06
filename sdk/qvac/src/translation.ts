// Local Treasury Translation adapter (Phase 19 §4).
//
// Mirrors atlas_qvac::translation. Cache is in-memory by default;
// host can swap a persistent backing store if desired.

export type LocaleTag = string; // BCP-47 tag, e.g. "ja-JP", up to 8 bytes for cache_key

export interface AlertTranslation {
  canonical_template_hash: string; // hex32
  target_locale: LocaleTag;
  rendered: string;
}

export type TranslationError = "identifier_altered" | "empty_output";

export type TranslationRunner = (canonical: string, locale: LocaleTag) => Promise<string>;

export class TranslationCache {
  private entries = new Map<string, AlertTranslation>();
  private hits = 0;
  private misses = 0;

  get(canonical: string, locale: LocaleTag): AlertTranslation | undefined {
    const key = cacheKey(canonical, locale);
    const v = this.entries.get(key);
    if (v) {
      this.hits += 1;
      return v;
    }
    this.misses += 1;
    return undefined;
  }

  put(canonical: string, locale: LocaleTag, rendered: string): AlertTranslation {
    const key = cacheKey(canonical, locale);
    const entry: AlertTranslation = {
      canonical_template_hash: key,
      target_locale: locale,
      rendered,
    };
    this.entries.set(key, entry);
    return entry;
  }

  hitRateBps(): number {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return Math.floor((this.hits * 10_000) / total);
  }

  size(): number { return this.entries.size; }
}

export async function renderTranslatedAlert(
  canonical: string,
  locale: LocaleTag,
  identifiersToPreserve: string[],
  cache: TranslationCache,
  runner: TranslationRunner,
): Promise<{ ok: AlertTranslation } | { err: TranslationError }> {
  const hit = cache.get(canonical, locale);
  if (hit) return { ok: hit };
  let rendered: string;
  try {
    rendered = await runner(canonical, locale);
  } catch {
    return { err: "empty_output" };
  }
  if (!rendered || rendered.trim().length === 0) return { err: "empty_output" };
  for (const id of identifiersToPreserve) {
    if (id && !rendered.includes(id)) return { err: "identifier_altered" };
  }
  return { ok: cache.put(canonical, locale, rendered) };
}

/**
 * `cache_key = blake3-equivalent stable hex` over the canonical
 * English source + locale. We use a deterministic non-crypto hash
 * (FNV-1a 64-bit, hex-padded to 32 bytes) so the JS package has
 * zero crypto dependency; the canonical Rust crate uses blake3.
 * Cache-line semantics are unaffected — both sides hash off the
 * same bytes; only the algorithm differs.
 */
export function cacheKey(canonical: string, locale: LocaleTag): string {
  return fnv1a64Hex(`atlas.qvac.translation.v1\n${canonical}\nlocale=${locale}`);
}

function fnv1a64Hex(s: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const ch of s) {
    h ^= BigInt(ch.charCodeAt(0));
    h = (h * prime) & mask;
  }
  // Pad to 64 hex characters (32 bytes); we left-pad with zeros.
  let hex = h.toString(16).padStart(16, "0");
  while (hex.length < 64) hex = "00" + hex;
  return hex;
}

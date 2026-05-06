//! Local Treasury Translation (directive §4).
//!
//! Local NMT model translates alert bodies + ledger row renderings
//! into the user's locale. Identifiers (vault IDs, public input
//! hashes, signatures, addresses) stay verbatim. Numbers stay in the
//! locale's number format but values are unchanged.
//!
//! Translation is cached by `(template_hash, target_locale)`. The
//! same alert class re-rendered in the same locale hits the cache;
//! the model is invoked only on a miss.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct LocaleTag(pub [u8; 8]);

impl LocaleTag {
    pub fn from_str(s: &str) -> Self {
        let mut out = [0u8; 8];
        let bytes = s.as_bytes();
        let n = bytes.len().min(8);
        out[..n].copy_from_slice(&bytes[..n]);
        Self(out)
    }
    pub fn as_str(&self) -> String {
        let end = self.0.iter().position(|b| *b == 0).unwrap_or(8);
        String::from_utf8_lossy(&self.0[..end]).to_string()
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TranslationError {
    #[error("identifier `{0}` was not preserved verbatim in the translated output")]
    IdentifierAltered(String),
    #[error("translated output is empty")]
    EmptyOutput,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AlertTranslation {
    pub canonical_template_hash: [u8; 32],
    pub target_locale: LocaleTag,
    pub rendered: String,
}

/// Domain-tagged hash over the canonical English template. Folds
/// the source string + locale together so the cache key is stable.
pub fn cache_key(canonical_english: &str, target_locale: LocaleTag) -> [u8; 32] {
    translation_cache_key(canonical_english.as_bytes(), &target_locale.0)
}

pub fn translation_cache_key(canonical_bytes: &[u8], locale: &[u8]) -> [u8; 32] {
    let mut h = blake3::Hasher::new();
    h.update(b"atlas.qvac.translation.v1");
    h.update(canonical_bytes);
    h.update(b".locale.");
    h.update(locale);
    *h.finalize().as_bytes()
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct TranslationCache {
    entries: BTreeMap<[u8; 32], AlertTranslation>,
    hits: u64,
    misses: u64,
}

impl TranslationCache {
    pub fn new() -> Self { Self::default() }
    pub fn get(&mut self, canonical: &str, locale: LocaleTag) -> Option<AlertTranslation> {
        let key = cache_key(canonical, locale);
        if let Some(v) = self.entries.get(&key).cloned() {
            self.hits = self.hits.saturating_add(1);
            return Some(v);
        }
        self.misses = self.misses.saturating_add(1);
        None
    }
    pub fn put(&mut self, canonical: &str, locale: LocaleTag, rendered: String) -> AlertTranslation {
        let key = cache_key(canonical, locale);
        let entry = AlertTranslation {
            canonical_template_hash: key,
            target_locale: locale,
            rendered,
        };
        self.entries.insert(key, entry.clone());
        entry
    }
    pub fn hit_rate_bps(&self) -> u32 {
        let total = self.hits.saturating_add(self.misses);
        if total == 0 { return 0; }
        ((self.hits.saturating_mul(10_000)) / total) as u32
    }
    pub fn entries(&self) -> usize { self.entries.len() }
    pub fn hits(&self) -> u64 { self.hits }
    pub fn misses(&self) -> u64 { self.misses }
}

/// Render a translated alert. Calls the model only on cache miss;
/// runs the identifier-preservation check on the model output before
/// caching. `identifiers_to_preserve` is the list of substrings (vault
/// IDs, hashes, addresses) that must survive translation byte-for-byte.
pub fn render_translated_alert<F>(
    canonical: &str,
    target_locale: LocaleTag,
    identifiers_to_preserve: &[&str],
    cache: &mut TranslationCache,
    translate_with_local_nmt: F,
) -> Result<AlertTranslation, TranslationError>
where
    F: FnOnce(&str, LocaleTag) -> String,
{
    if let Some(hit) = cache.get(canonical, target_locale) {
        return Ok(hit);
    }
    let rendered = translate_with_local_nmt(canonical, target_locale);
    if rendered.trim().is_empty() {
        return Err(TranslationError::EmptyOutput);
    }
    for id in identifiers_to_preserve {
        if !id.is_empty() && !rendered.contains(id) {
            return Err(TranslationError::IdentifierAltered((*id).to_string()));
        }
    }
    Ok(cache.put(canonical, target_locale, rendered))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locale_tag_round_trip() {
        let tag = LocaleTag::from_str("ja-JP");
        assert_eq!(tag.as_str(), "ja-JP");
    }

    #[test]
    fn cache_key_distinguishes_locale() {
        let a = cache_key("Vault paused", LocaleTag::from_str("en-US"));
        let b = cache_key("Vault paused", LocaleTag::from_str("ja-JP"));
        assert_ne!(a, b);
    }

    #[test]
    fn cache_key_distinguishes_canonical() {
        let a = cache_key("Vault paused", LocaleTag::from_str("ja-JP"));
        let b = cache_key("Vault resumed", LocaleTag::from_str("ja-JP"));
        assert_ne!(a, b);
    }

    #[test]
    fn render_caches_after_first_call() {
        let mut cache = TranslationCache::new();
        let canonical = "Vault ab12 paused due to defensive mode.";
        let locale = LocaleTag::from_str("ja-JP");
        let mut calls = 0;
        for _ in 0..3 {
            let _ = render_translated_alert(
                canonical,
                locale,
                &["ab12"],
                &mut cache,
                |s, _| {
                    calls += 1;
                    s.replace("Vault", "ボールト").replace("paused", "停止")
                },
            )
            .unwrap();
        }
        assert_eq!(calls, 1, "model should be called only once");
        assert_eq!(cache.hits(), 2);
        assert_eq!(cache.misses(), 1);
    }

    #[test]
    fn identifier_dropped_in_output_rejected() {
        let mut cache = TranslationCache::new();
        let r = render_translated_alert(
            "Vault ab12 paused.",
            LocaleTag::from_str("ja-JP"),
            &["ab12"],
            &mut cache,
            |_, _| "ボールト 停止".into(), // dropped "ab12"
        );
        assert!(matches!(r, Err(TranslationError::IdentifierAltered(s)) if s == "ab12"));
    }

    #[test]
    fn empty_output_rejected() {
        let mut cache = TranslationCache::new();
        let r = render_translated_alert(
            "Vault paused.",
            LocaleTag::from_str("ja-JP"),
            &[],
            &mut cache,
            |_, _| "".into(),
        );
        assert!(matches!(r, Err(TranslationError::EmptyOutput)));
    }

    #[test]
    fn hit_rate_bps_correct() {
        let mut cache = TranslationCache::new();
        cache.put("a", LocaleTag::from_str("ja"), "あ".into());
        cache.put("b", LocaleTag::from_str("ja"), "い".into());
        // 2 misses on the puts? No — put doesn't bump miss. Force misses through get.
        let _ = cache.get("c", LocaleTag::from_str("ja")); // miss
        let _ = cache.get("a", LocaleTag::from_str("ja")); // hit
        let _ = cache.get("b", LocaleTag::from_str("ja")); // hit
        let _ = cache.get("a", LocaleTag::from_str("ja")); // hit
        // 3 hits / 4 total = 7500 bps.
        assert_eq!(cache.hit_rate_bps(), 7_500);
    }

    #[test]
    fn cache_returns_same_entry_on_hit() {
        let mut cache = TranslationCache::new();
        let canonical = "Vault paused.";
        let locale = LocaleTag::from_str("ja-JP");
        let first = render_translated_alert(
            canonical, locale, &[], &mut cache,
            |_, _| "ボールト 停止".into(),
        ).unwrap();
        let second = cache.get(canonical, locale).unwrap();
        assert_eq!(first.rendered, second.rendered);
    }
}

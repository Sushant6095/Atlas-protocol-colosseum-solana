// TranslationToggle — Phase 24 §6.3.
//
// Per-alert switch between the canonical English template and a
// locally-rendered translation. The runner is supplied by the host
// (browser worker → @qvac/llm-llamacpp). On any preserve-identifier
// failure or empty output, we surface the canonical template instead
// of the model's output and remember the failure so the toggle is
// disabled until the next alert.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TranslationCache, renderTranslatedAlert,
  type LocaleTag, type TranslationError,
} from "@atlas/qvac";

type Runner = (canonical: string, locale: LocaleTag) => Promise<string>;

export interface TranslationToggleProps {
  canonical: string;
  /** Identifier substrings (vault id, tx hash, …) the translation
   *  must keep verbatim. */
  identifiersToPreserve?: string[];
  /** Active locale. Pass the same value the rest of the app uses. */
  locale: LocaleTag;
  /** Local LLM runner. */
  runner: Runner;
  /** Cache reused across mounts; supply one at app root. */
  cache?: TranslationCache;
  /** Optional className for the wrapping <div>. */
  className?: string;
}

export function TranslationToggle({
  canonical, identifiersToPreserve = [], locale, runner, cache, className,
}: TranslationToggleProps): JSX.Element {
  const sharedCache = useMemo(() => cache ?? new TranslationCache(), [cache]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [rendered, setRendered] = useState<string | null>(null);
  const [error, setError] = useState<TranslationError | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset state when the canonical alert changes.
  useEffect(() => {
    setShowTranslation(false);
    setRendered(null);
    setError(null);
  }, [canonical, locale]);

  async function ensureTranslation(): Promise<void> {
    if (rendered || error) return;
    setBusy(true);
    const r = await renderTranslatedAlert(canonical, locale, identifiersToPreserve, sharedCache, runner);
    setBusy(false);
    if ("ok" in r) {
      setRendered(r.ok.rendered);
    } else {
      setError(r.err);
    }
  }

  async function toggle(): Promise<void> {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    await ensureTranslation();
    if (!error) setShowTranslation(true);
  }

  const text = showTranslation && rendered ? rendered : canonical;
  const isRtl = isRtlLocale(locale);

  return (
    <div className={className} dir={showTranslation && isRtl ? "rtl" : undefined}>
      <p className="text-[14px]" style={{ color: "var(--color-ink-secondary)" }}>{text}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px]"
           style={{ color: "var(--color-ink-tertiary)" }}>
        <button onClick={() => void toggle()} disabled={busy || !!error}
                aria-pressed={showTranslation}
                className="underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                style={{ color: error ? "var(--color-danger)" : "var(--color-electric)" }}>
          {busy ? "translating…"
            : showTranslation ? "show canonical (English)"
            : `translate to ${locale}`}
        </button>
        {error && <span>local translation unavailable</span>}
      </div>
    </div>
  );
}

function isRtlLocale(locale: string): boolean {
  const root = locale.split("-")[0]?.toLowerCase();
  return root === "ar" || root === "he" || root === "fa" || root === "ur";
}

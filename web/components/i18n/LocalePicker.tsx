// LocalePicker — Phase 24 §7.2.
//
// Compact <select> wired to the locale store. Drop into the
// navbar or footer. RTL is applied automatically on the
// <html dir> attribute by `applyLocale`.

"use client";

import { useLocale } from "@/lib/i18n/locale-store";
import type { Locale } from "@/lib/i18n";

const LABELS: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
  ar: "العربية",
};

export function LocalePicker(): JSX.Element {
  const { locale, available, setLocale } = useLocale();
  return (
    <label className="flex items-center gap-2 text-[11px]"
           style={{ color: "var(--color-ink-tertiary)" }}>
      <span className="uppercase tracking-[0.06em]">locale</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="rounded px-2 py-1 font-mono text-[11px]"
        style={{
          background: "var(--color-surface-sunken)",
          color: "var(--color-ink-primary)",
          border: "1px solid var(--color-line)",
        }}
      >
        {available.map((l) => (
          <option key={l} value={l}>{LABELS[l]}</option>
        ))}
      </select>
    </label>
  );
}

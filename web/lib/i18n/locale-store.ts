// Locale store — persists the active locale in localStorage and
// reflects it on <html lang dir>. Driven by the LocalePicker.

"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, isLocale, isRtl, type Locale } from "./index";
import { loadMessages } from "./messages";
import type { MessageCatalog } from "./index";

const STORAGE_KEY = "atlas.locale.v1";

export function readLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  const nav = navigator.language?.split("-")[0];
  return isLocale(nav) ? (nav as Locale) : DEFAULT_LOCALE;
}

export function writeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  applyLocale(locale);
}

export function applyLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
}

export interface UseLocaleResult {
  locale: Locale;
  catalog: MessageCatalog;
  setLocale: (next: Locale) => void;
  available: readonly Locale[];
}

export function useLocale(): UseLocaleResult {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const initial = readLocale();
    setLocaleState(initial);
    applyLocale(initial);
  }, []);

  function setLocale(next: Locale): void {
    setLocaleState(next);
    writeLocale(next);
  }

  return {
    locale,
    catalog: loadMessages(locale),
    setLocale,
    available: LOCALES,
  };
}

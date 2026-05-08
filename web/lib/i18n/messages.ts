// Message catalogs — Phase 24 §7.
//
// Hand-translated launch dictionary. Adding a key here is a
// deliberate choice — every locale must keep parity, and the
// type-checker enforces it.

import type { Locale, MessageCatalog } from "./index";

import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import es from "../../messages/es.json";
import ar from "../../messages/ar.json";

const CATALOGS: Record<Locale, MessageCatalog> = {
  en: en as MessageCatalog,
  ja: ja as MessageCatalog,
  es: es as MessageCatalog,
  ar: ar as MessageCatalog,
};

export function loadMessages(locale: Locale): MessageCatalog {
  return CATALOGS[locale];
}

export function t(
  catalog: MessageCatalog,
  key: keyof MessageCatalog,
  vars?: Record<string, string | number>,
): string {
  const base = catalog[key];
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined ? `{${k}}` : String(v);
  });
}

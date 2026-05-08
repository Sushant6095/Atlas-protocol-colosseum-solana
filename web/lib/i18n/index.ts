// i18n bootstrap — Phase 24 §7.
//
// Atlas ships with four launch locales. The catalog is a typed
// dictionary so missing keys break the type-check before they reach
// the UI. Translation runtime: an ICU-style message format is
// overkill at this stage — the public surface uses placeholder
// substitution `{key}` only. When a phrase needs grammatical
// inflection, route it through `@atlas/qvac` translation instead so
// the locally-generated text inherits the verifiable identifier
// guard from Phase 19.

export const LOCALES = ["en", "ja", "es", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

export const DEFAULT_LOCALE: Locale = "en";

export interface MessageCatalog {
  // global header / nav
  "nav.docs":       string;
  "nav.dashboard":  string;
  "nav.intel":      string;
  "nav.infra":      string;
  // pre-sign explainer
  "presign.title":      string;
  "presign.subtitle":   string;
  "presign.approve":    string;
  "presign.approveAnyway": string;
  "presign.reject":     string;
  "presign.localLLM":   string;
  "presign.template":   string;
  // realtime status pills
  "rt.live":            string;
  "rt.degraded":        string;
  "rt.paused":          string;
  // alerts
  "alerts.empty":       string;
  "alerts.acknowledge": string;
}

export type MessageKey = keyof MessageCatalog;

export function isLocale(s: string | undefined | null): s is Locale {
  return !!s && (LOCALES as readonly string[]).includes(s);
}

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}

# Atlas i18n

Phase 24 §7. Four launch locales: **en**, **ja**, **es**, **ar**.

## Files

- `index.ts` — `Locale` type, `RTL_LOCALES`, `MessageKey`, helpers.
- `messages.ts` — bundles all four catalogs, exports `t()`.
- `locale-store.ts` — `useLocale()` hook + `writeLocale()` setter.
- `../../messages/{locale}.json` — hand-translated catalogs (parity-checked by `MessageCatalog` interface).
- `../../components/i18n/LocalePicker.tsx` — UI control.

## Adding a key

1. Add the entry to `MessageCatalog` in `index.ts`.
2. Update every `messages/{locale}.json` — TypeScript will fail the
   build until each file is in parity.
3. Reference via `t(catalog, "your.key", { var })`.

## RTL

Arabic is the only RTL locale in the launch set. `applyLocale()`
sets `<html dir="rtl">`; component-level `dir` overrides are the
exception, used in `TranslationToggle` when previewing a
non-display-language translation.

## Why this is a stub

We deliberately don't pull `next-intl` or `formatjs`. ICU pluralisation
and grammatical inflection are routed through `@atlas/qvac` translation
instead so the locally-rendered alert inherits the verifiable
identifier guard from Phase 19. Static UI strings cover the
"chrome" — buttons, headers, status pills — and need only
placeholder substitution.

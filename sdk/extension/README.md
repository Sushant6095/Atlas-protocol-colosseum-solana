# Atlas Browser Extension

Chrome + Firefox MV3 extension built with [WXT]. Surfaces the Atlas
inspector beside any Solana site: pre-sign payload explanations,
freshness checks, allowlist editor.

## Run

```bash
pnpm i
pnpm dev          # Chrome
pnpm dev:firefox  # Firefox
```

`pnpm build` emits `.output/<browser>-mv3/` ready for `pnpm zip` →
Web Store / AMO submission.

## Surfaces

- **Toolbar popup** — compact freshness tile + open inspector CTA.
- **Side panel** — full pre-sign overlay + allowlist editor.
- **Content overlay** — neutral "reviewing…" card injected on
  allowlisted origins while the side panel resolves the explanation.

## Storage

`chrome.storage.local`:
- `atlas.allowlist.v1` — `AllowlistEntry[]`
- `atlas.settings.v1`  — `ExtensionSettings`

Both schemas live in [`lib/storage.ts`](./lib/storage.ts).

## Wallet bridge contract

The page emits `atlas:wallet-intercept` with `{ method, payloadB64 }`
before its wallet adapter signs. The content script forwards this to
the side panel only when `origin` is on the user's allowlist. Atlas
never touches keys — it only renders explanations.

[WXT]: https://wxt.dev

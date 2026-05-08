# Atlas iOS — App Store Submission Notes

This file is the running submission record for the App Store /
TestFlight pipeline. Update it when you change anything reviewers
care about.

## Identity

- **Display name** — Atlas
- **Bundle ID** — `com.atlas.treasury`
- **Category** — Finance (primary), Productivity (secondary)
- **Min iOS** — 17.0

## What the app does (one screen)

Atlas surfaces a verifiable AI treasury OS for Solana protocols and
DAOs. Users monitor proven rebalances, freshness budgets, alerts,
and pending Squads-routed approvals. Atlas never holds keys — every
signing operation is delegated to the user's installed Solana wallet
through Mobile Wallet Adapter.

## Why this is not a wallet

- No private keys are generated, stored, or transmitted by Atlas.
- Approvals are signed by the user's chosen wallet (Phantom,
  Solflare, Backpack, …) via the public Solana Mobile Wallet Adapter
  protocol. Atlas only forwards the signed payload to the Atlas API.
- Atlas never custodies user funds. All TVL displayed is from the
  user's connected vault accounts on chain.

## Permissions / capabilities used

- **Face ID / Touch ID / passcode** — gate the app on launch and on
  return-from-background after >30s. See
  `Atlas/Signing/BiometricGate.swift`.
- **Network** — HTTPS only to the user-configured Atlas backend
  (default `https://app.atlas.example`).
- **No** location, contacts, calendar, photos, microphone, or camera.

## App Tracking Transparency

Atlas does not track users across apps or websites. ATT prompt is
not shown.

## Demo account for review

A read-only demo account is included for App Review. Tap **Use demo**
on the unlock screen → biometric prompt is bypassed and a fixture
treasury is loaded so reviewers can browse all five tabs without a
wallet.

## Privacy disclosure (App Store Connect)

| Data Type | Linked to user | Tracking | Purpose |
|---|---|---|---|
| Wallet public address | yes (when user pairs a wallet) | no | App functionality |
| Crash diagnostics | no | no | Stability |

No other categories collected.

## Export compliance

Atlas does not include cryptography beyond what Apple ships in
CommonCrypto / CryptoKit. Standard exemption applies; no ERN required.

## Review notes — common rejection vectors covered

- **Mobile Wallet Adapter** — third-party wallet integration is
  performed via the public spec; we link reviewers to
  https://docs.solanamobile.com/mobile-wallet-adapter/overview.
- **Cryptocurrency on-chain transactions** — Atlas displays
  transaction context only; the actual signing happens in a separate
  app the user has installed.
- **Free trial / paid features** — there are none. Atlas is free for
  the hackathon submission.

# Atlas Sentinel

Personal yield and portfolio command center for Solana DeFi. Companion
to [atlasfi.in](https://atlasfi.in) (institutional treasury OS).

> **Phase 0 — fixtures only.** Full UI shell with all states. SDK
> wiring (Kamino positions, Birdeye intelligence, Quicknode RPC,
> Solflare signing, DFlow hedging) lands in Phase 1+ as keys arrive.

## Partner integrations

| Partner | Role | Phase 0 | Phase 1 |
|---|---|---|---|
| **Solflare** | Wallet layer (wallet-standard) | mock connect via `WalletGate` local state | `@solana/wallet-adapter-react` |
| **Quicknode** | Primary Solana RPC | public mainnet fallback | env `NEXT_PUBLIC_RPC_URL` |
| **Kamino** | Yield substrate (vault positions) | 4 fixture positions | `@kamino-finance/klend-sdk` |
| **Birdeye** | Market intelligence (whale txs + anomalies) | 4 token stats + 5 whale txs fixture | `bds.birdeye.so` `/defi/*` |
| **DFlow** | Execution layer (hedge dropdown) | "Coming Phase 2" stub | deferred (Phase 2 scope) |

## Local dev

```bash
cd atlas/apps/sentinel
pnpm install   # picks up workspace
pnpm dev       # http://localhost:3100
```

## Routes

| Path | What it shows |
|---|---|
| `/` | Home — KPIs + position cards + Birdeye sidebar, fixture data. "Watch any wallet" input is the public share-loop entry. |
| `/w/<address>` | Read-only viewer for any Solana wallet. Pass `vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg` (Kamino treasury) to see populated state; any other address shows empty-state. |

## States handled

- **Loading** — skeleton cards via `<PositionGrid loading />`
- **Empty wallet** — illustration + Kamino CTA
- **RPC failure** — `<PositionCard reconnecting />` inline pill
- **Solflare rejected** — toast wired in Phase 1
- **Read-only viewer** — `/w/<address>` route

## Phase 1 checklist

- [ ] Provision Quicknode endpoint → `NEXT_PUBLIC_RPC_URL`
- [ ] Provision Birdeye key → `NEXT_PUBLIC_BIRDEYE_KEY`
- [ ] Install `@kamino-finance/klend-sdk` + wire reads behind `KAMINO_LIVE`
- [ ] Replace `WalletGate` mock with real `useWallet()` from wallet-adapter-react
- [ ] Wire `<BirdeyeIntel>` SWR fetches (refresh 30s)
- [ ] Add 4s position-state polling with exponential backoff on error
- [ ] Live PnL calc against actual deposit basis

## Phase 2

- DFlow quote integration in `<PositionCard>` Hedge dropdown
- Slot/signature subscriptions for sub-second freshness on opened cards
- Push notifications for whale txs on user-held tokens

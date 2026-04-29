# Atlas — Verifiable AI DeFi for Solana

> Consumer DeFi web app on Solana where AI rebalances USDC across Kamino, Drift, and Jupiter — every move cryptographically proven via SP1 zkVM.

Built for **Solana Colosseum Frontier hackathon (Apr–May 2026)** spanning **Infra · DeFi · Consumer** tracks.

## Why

Every AI yield product on Solana today asks users to trust a curator. Atlas removes that trust requirement: the strategy is committed at deposit, the AI agent can only rebalance with a valid SP1 proof of inference, and the Solana program rejects any move without it.

## Architecture

```
web (Next.js 15) ──▶ atlas_vault ──▶ Kamino / Drift / Jupiter / marginfi (CPI)
                          ▲
                          │ (proof-gated CPI)
                          │
                  atlas_rebalancer ──CPI──▶ atlas_verifier (sp1-solana Groth16)
                          ▲
                          │ submits proof
                          │
   off-chain orchestrator ─── SP1 zkVM ─── inference + state-root commitment
```

## Layout

| Path | Purpose |
|---|---|
| `programs/atlas-verifier/` | onchain Groth16 verifier (wraps `sp1-solana`) |
| `programs/atlas-registry/` | model commitments (compressed merkle) + prover bonds |
| `programs/atlas-vault/` | Token-2022 USDC vault, share accounting, strategy commitment |
| `programs/atlas-rebalancer/` | proof-gated allocator, CPI to DeFi protocols |
| `prover/zkvm-program/` | SP1 guest — proves MLP inference + state-root |
| `prover/orchestrator/` | Tokio service: fetch state → prove → submit |
| `prover/model/` | PyTorch trainer + ONNX → binary weights |
| `sdk/rust/` | Rust client (PDAs + ix builders) |
| `sdk/ts/` | TypeScript client (`@solana/kit`) |
| `web/` | Next.js 15 app at atlas.fyi |
| `tests/{litesvm,surfpool,mollusk}/` | unit + mainnet-fork + CU benchmarks |

## Quickstart (developer)

```bash
# 1. Toolchain
rustup install stable && rustup default stable
cargo install --locked --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.32.1
curl -L https://sp1.succinct.xyz | bash && sp1up

# 2. Build programs
cd atlas
anchor build

# 3. Train model + export binary weights
cd prover/model && pip install -r requirements.txt && python train.py

# 4. Build SP1 guest + run an end-to-end proof locally
cd ../zkvm-program && cargo prove build

# 5. Run web app
cd ../../web && pnpm install && pnpm dev
# → http://localhost:3000
```

## Security model

- Strategy commitment is immutable post `init_vault` — admin cannot rotate it
- Withdraws bypass proofs — exits cannot be censored
- Rebalancer requires fresh proof (≤150 slots ≈ 60s) to prevent stale-state attacks
- Prover bonds in Token-2022 enable permissionless prover participation w/ slashing

## Status

| Phase | Scope |
|---|---|
| Phase 1 (this commit) | Repo scaffold · 4 program skeletons · SP1 guest · orchestrator skeleton · web app |
| Phase 2 | Verifier CPI wiring · vault deposit/withdraw on devnet · MLP guest training · Kamino CPI |
| Phase 3 | Drift + Jupiter CPIs · Blinks viral loop · passkey onboarding · mainnet deploy · demo |

## Grant

Submitted to **Solana Foundation Agentic Engineering Grant** ($200 USDG). See [docs/grant-application.md](docs/grant-application.md).

## License

Apache-2.0

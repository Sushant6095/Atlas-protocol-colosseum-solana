# Atlas — Agentic Engineering Grant Application

**Submission to:** https://superteam.fun/earn/grants/agentic-engineering
**Grant amount:** 200 USDG
**Hackathon:** Solana Colosseum Frontier (deadline 2026-05-12)
**Repo:** https://github.com/Sushant6095/Atlas-protocol-colosseum-solana

---

## Step 1 — Basics

| Field | Value |
|---|---|
| Project Title | Atlas — Verifiable AI DeFi for Solana |
| One Line Description | Consumer DeFi on Solana: AI rebalances USDC across Kamino/Drift/Jupiter, every move zkML-proven via SP1. |
| TG username | t.me/<TODO_handle> |
| Wallet Address | <TODO_solana_pubkey> |

---

## Step 2 — Details

### Project Details

Every AI yield product on Solana asks depositors to trust the curator. When a vault rebalances across Kamino, Drift, or Jupiter, no cryptographic artifact distinguishes legitimate rebalancing from soft-rug behavior.

Atlas closes the gap with three layers in one codebase: an open zkML coprocessor (any Solana program verifies ML inferences via CPI, powered by SP1 zkVM + sp1-solana Groth16 verifier), Atlas Vault (USDC rebalanced across Kamino, Drift, Jupiter, marginfi — strategy committed as an immutable Poseidon hash, every move gated on a fresh SP1 proof), and atlas.fyi consumer app (Phantom/Solflare/WalletConnect QR, live proof feed, Solana Blinks).

Verifying a Groth16 proof on Solana costs ~$0.0001 via alt_bn128 syscalls — viable only here. Grant ships four Anchor programs to mainnet, an open Rust+TS SDK, and a working end-to-end demo. Zero zkML projects exist across four prior Colosseum hackathons.

### Deadline

2026-05-12 (Asia/Calcutta) — Frontier hackathon submission window close.

### Proof of Work

- **GitHub repo:** https://github.com/Sushant6095/Atlas-protocol-colosseum-solana
- **Recent commits**
  - `7bf0ac0` chore(web): bump Next to ^15.5.7 to patch CVE-2025-66478
  - `c1f0a33` fix(web): disable typedRoutes to unblock Vercel build
  - `50887e8` fix(web): add default return in protoColor to fix TS build
  - `14857f7` chore: initial scaffold for Atlas protocol
- **Built**
  - 4 Anchor programs (atlas_verifier, atlas_registry, atlas_vault, atlas_rebalancer) wired against sp1-solana, Token-2022, Kamino/Drift/Jupiter/marginfi CPI scaffolds
  - SP1 zkVM guest program proving MLP inference + Poseidon state-root commitment (Rust, RISC-V)
  - Tokio off-chain orchestrator w/ Jito bundle submission scaffold
  - Next.js 15 web app: real Phantom/Solflare connect, live SOL balance, signed devnet deposit flow w/ Solana FM toast, WalletConnect QR + mobile QR pairing, DeFiLlama Yields integration
  - 15 Atlas vault definitions across 8 categories (Stable/Volatile/LST/Hybrid/RWA/LP/Mixed)
  - Codama TS SDK + Rust SDK
  - LiteSVM / Surfpool / Mollusk test scaffolds, Fly.io + RunPod GPU prover Dockerfile

### Personal X Profile

x.com/<TODO_handle>

### Personal GitHub Profile

https://github.com/Sushant6095

### Colosseum Crowdedness Score

<TODO_drive_link_to_screenshot>

Process: visit https://colosseum.com/copilot → enter Atlas pitch → screenshot result page → upload to public Google Drive → paste link.

Verified earlier via Colosseum Copilot direct API: zero zkML-on-Solana projects exist across Renaissance, Radar, Breakout, Cypherpunk hackathons + accelerator alumni + prize winners. Closest analogs (signed-ai, forge-ai, velane) skip proof-of-execution. Adjacent FHE work (shadow-book, lattica, encifher) targets a different primitive.

### AI Session Transcript

`./claude-session.jsonl` (attached separately to grant form, also included in this Drive bundle).

---

## Step 3 — Milestones

### M1 · May 1–4 — Verifier deployed
- atlas_verifier deployed to devnet, verifying SP1 Groth16 proofs onchain
- SP1 guest program compiled, end-to-end proof generation on local prover
- Mollusk benchmark <300k CU per verify call

### M2 · May 5–8 — Vault + first CPI live
- atlas_vault deployed to devnet with Token-2022 USDC deposit/withdraw + share accounting
- atlas_rebalancer wired to atlas_vault via CPI, gated on verifier
- First Kamino lending CPI live; rebalance landing onchain w/ valid proof

### M3 · May 9–11 — Multi-protocol + consumer UX
- Drift v2 + Jupiter v6 + marginfi v2 CPIs integrated, full 4-leg rebalance in single Jito bundle
- Web app polished — proof feed pulls real onchain events; Blinks + WalletConnect QR shipped
- Mainnet-beta deploy w/ TVL cap $1k

### M4 · May 12 — Submission
- 3-min demo video: deposit → AI rebalance into Kamino → proof publicly verifiable on Solana FM
- Open SDK published to crates.io (atlas-sdk) + npm (@atlas/sdk)
- Atlas listed on Colosseum Frontier; one cross-team integration consuming the SDK

### Primary KPI

**One end-to-end mainnet rebalance with a publicly verifiable SP1 proof linked from atlas.fyi.**

A single rebalance tx on mainnet-beta, signed by `atlas_rebalancer`, gated on `atlas_verifier::verify` CPI, executing real Kamino + Drift + Jupiter CPIs, with the SP1 proof hash visible in the Atlas proof feed UI and the tx visible on Solana FM.

### Final tranche checklist

- [x] Colosseum project link (will be filed at submission)
- [x] GitHub repo (https://github.com/Sushant6095/Atlas-protocol-colosseum-solana)
- [ ] AI subscription receipt (Claude Pro / Codex receipt PDF)

---

## Budget (200 USDG)

| Item | USDG |
|---|---|
| RunPod RTX 4090 GPU prover (~14 days) | 100 |
| Solana mainnet rent + priority fees | 40 |
| Fly.io orchestrator hosting | 20 |
| Vercel Pro + atlas.fyi domain | 40 |

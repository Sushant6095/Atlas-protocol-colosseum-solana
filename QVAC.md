# Atlas Local-AI Layer — Tether QVAC Integration

> The structured payload comes from Atlas. The plain-language
> explanation, the invoice OCR, the alert translation, and the
> second-opinion review run on your device with QVAC. The proof is
> public; the AI rationalising your action stays local.

## What Phase 19 ships

| Surface | Code |
|---|---|
| Pre-Sign Explainer with numeric-token verification + template fallback | [crates/atlas-qvac/src/explainer.rs](crates/atlas-qvac/src/explainer.rs) |
| Invoice OCR draft + operator-confirmation flow | [crates/atlas-qvac/src/ocr.rs](crates/atlas-qvac/src/ocr.rs) |
| Treasury translation with `(template_hash, locale)` cache + identifier preservation | [crates/atlas-qvac/src/translation.rs](crates/atlas-qvac/src/translation.rs) |
| Second-Opinion Analyst calibrated against the failure-class catalog | [crates/atlas-qvac/src/analyst.rs](crates/atlas-qvac/src/analyst.rs) |
| `lint_no_qvac_in_commitment_path` (CI-enforced) | [crates/atlas-runtime/src/lints.rs](crates/atlas-runtime/src/lints.rs) |
| 7 Phase 19 telemetry metrics | [crates/atlas-telemetry/src/lib.rs](crates/atlas-telemetry/src/lib.rs) |
| 3 REST endpoints (`/legal/qvac`, `/qvac/alert-templates`, `/treasury/{id}/invoices/draft`) | [crates/atlas-public-api/src/endpoints.rs](crates/atlas-public-api/src/endpoints.rs) |
| atlas-rs client + `@atlas/sdk` methods | [crates/atlas-rs/src/client.rs](crates/atlas-rs/src/client.rs) + [sdk/ts/src/platform.ts](sdk/ts/src/platform.ts) |
| `@atlas/qvac` TS package (explainer / ocr / translation / analyst) | [sdk/qvac/](sdk/qvac/) |
| `/qvac` playground demonstrating all four Tier-A surfaces | [sdk/playground/qvac.html](sdk/playground/qvac.html) |

## Hard rule

QVAC output never enters a Poseidon commitment path. The
deterministic MLP committed at vault creation (Phase 01 I-1) and the
7-agent ensemble are the only inputs to allocation proofs. QVAC is
*advisory UX*:

- A local LLM **explains** a transaction the user is about to sign —
  never decides what the transaction does.
- A local OCR **extracts** invoice fields — never authoritatively
  bills a treasury.
- A local translator **renders** an alert in another language —
  never edits the alert's class or severity.
- A local analyst **gives a second opinion** — never overrides the
  multisig.

The `lint_no_qvac_in_commitment_path` runtime lint blocks any QVAC
SDK / `atlas_qvac::` import inside `atlas-pipeline`, `atlas-bus`,
`atlas-replay`, `atlas-warehouse`, `atlas-sandbox`,
`atlas-public-input`, or `atlas-verifier`. CI runs this against
every commit; the metric `atlas_qvac_commitment_path_imports_total`
is a hard alert as defence in depth.

## Tier-A surfaces

### 1. Pre-Sign Explainer

Local LLM renders the structured `/api/v1/simulate/{ix}` payload as
a 3-sentence summary in the user's locale. Numeric-token verification
parses the LLM output and asserts every digit run also appears in the
payload; if anything is missing or invented, we fall back to a
deterministic template. **The signing flow is never blocked.**

- Temperature: 0.0
- Max output tokens: 300
- Outcome surfaced as `local_llm` / `template_fallback`
- Same logic on Rust (canonical) + TS (`@atlas/qvac/explainer`)

### 2. Invoice OCR

Local `@qvac/ocr-onnx` extracts vendor / amount / due-date / mint
from a paper or PDF invoice into `DraftInvoiceState`. The image and
the raw OCR text never leave the operator's device. `is_confirmed()`
returns true only when each required field is `(High confidence,
Operator source)` — i.e. either hand-edited or one-tap accepted.
Atlas refuses any draft where this is false.

- `accept_local_ocr()` flips a High-confidence local-OCR result to
  Operator source (one-tap accept).
- `operator_override()` sets a hand-edited value at High + Operator.
- `validate_for_submission()` returns the first missing-field error
  in deterministic order.

### 3. Treasury Translation

Local NMT model translates alert bodies + ledger row renderings.
Identifiers (vault ids, public-input hashes, signatures, addresses)
must survive translation byte-for-byte; if any is dropped, the
output is rejected. Numbers stay in the locale's number format but
values are unchanged.

- Cache keyed by `(blake3("atlas.qvac.translation.v1" || canonical
  || locale))`; same alert class re-rendered in the same locale
  hits the cache.
- `hit_rate_bps()` reports against the 80% steady-state SLO.

### 4. Second-Opinion Analyst

Local LLM + RAG produces an independent assessment of a pending
Squads bundle. Calibrated against the failure-class catalog:
recognised concerns clear; novel concerns surface as
`unrecognised concern — escalate`. `clears_for_signing` collapses to
true only when the recommendation is `Approve` AND every concern is
recognised.

- `validate_assessment()` rejects `confidence_bps > 10_000` and
  inconsistent `Approve + concerns > 0` shapes (UI must escalate).
- Catalog includes Phase 18 PER classes (per_session_expired,
  settlement_verifier_reject, etc.) so the analyst recognises the
  full failure surface.

## Out-of-scope (deliberate)

| | Why not |
|---|---|
| Replace the commitment-path MLP with a local LLM | The MLP's hash is committed at vault creation (I-1). A non-deterministic LLM can't satisfy that. |
| Replace the 7-agent ensemble | Same reason. |
| Generate SP1 proofs on-device | Devices lack the resources; prover registry slashing posture would be void. |
| Tether WDK custom wallet | Atlas is non-custodial; users connect existing wallets via wallet-standard. |
| STT voice commands | Accidental-execution risk too high for a treasury context. |
| TTS for alerts | Push notifications are the alert surface; TTS adds nothing for the audience. |

Picking deliberately is itself the signal.

## Telemetry

| Metric | SLO |
|---|---|
| `atlas_qvac_presign_explainer_render_ms` (p99) | ≤ 1500 ms (supported hardware) |
| `atlas_qvac_numeric_verification_failure_total` | < 1% on valid payloads |
| `atlas_qvac_ocr_field_extraction_accuracy_bps` | ≥ 9_500 on Atlas's curated invoice fixtures |
| `atlas_qvac_translation_cache_hit_rate_bps` | ≥ 8_000 steady state |
| `atlas_qvac_cold_load_seconds` (p95) | ≤ 6s LLM, ≤ 3s OCR, ≤ 3s NMT |
| `atlas_qvac_commitment_path_imports_total` | hard alert on any |
| `atlas_qvac_analyst_unrecognised_concern_total` | dashboarded for prompt-tuning |

No inference content leaves the device. Only aggregate counters via
opt-in client telemetry.

## Acceptance bar

- 40 unit tests in `atlas-qvac` cover: numeric-token verification on
  clean output, invented-number rejection, empty-output rejection,
  over-cap rejection, template-fallback on LLM error, deterministic
  template, OCR draft confirmation requires Operator source,
  high-confidence local-OCR still requires accept, operator override
  flips to High + Operator, validate-for-submission ordering,
  identifier-dropped translation rejection, cache hit/miss accounting,
  hit-rate bps math, analyst confidence cap, inconsistent
  Approve+concerns rejection, unrecognised-concern surfacing,
  case-insensitive catalog match, Phase 18 PER classes in catalog.
- 5 commitment-path lint tests in `atlas-runtime` cover Rust use
  imports, npm `@qvac/*` package imports, type-name leaks, clean
  passes, non-commitment-path crates exempt.
- `/qvac` playground exercises all four surfaces interactively
  (including the "try invented number" demo for fallback) without a
  build step.

## Distribution

The four surfaces ship through the existing Phase 16 transports:

| Surface | iOS | Browser extension | Web |
|---|---|---|---|
| Pre-Sign Explainer | ✓ | ✓ | ✓ |
| Invoice OCR | ✓ |   | ✓ |
| Treasury Translation | ✓ | ✓ | ✓ |
| Second-Opinion Analyst | ✓ |   | ✓ |

Models load on first use, cached locally afterwards. Cold-load p95
budgets are surfaced in app settings; users with bandwidth
constraints can disable per-surface.

## Why this is a deliberate scope

Phase 19 is Tier 3 — supporting integration. The narrative driver
remains "autonomous, zk-verified treasury OS for stablecoin capital."
QVAC adds a privacy posture at the user-experience layer that
complements Phase 14 (state private), Phase 18 (execution private),
and the proof-public-by-default invariant: **the AI rationalising
your action stays on your device.**

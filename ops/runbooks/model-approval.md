# Runbook — Model Approval Flow

End-to-end procedure for moving a model from `Draft` to `Approved` per
directive 06 §3.

## Roles + key separation

Three keys, three different humans. Anti-pattern §6 forbids self-audit:
the registry itself rejects an `AuditEntry` whose `auditor_pubkey`
matches the `trainer_pubkey`.

| Role | Holds | Allowed actions |
|---|---|---|
| Trainer | training keypair | `register`, sign artifacts |
| Auditor | audit signing key | `audit`, sign report hash |
| Governance | multisig threshold | `approve`, `flag-drift`, `slash` |

## Step 1 — Train + register

The trainer publishes the model artifact to a content-addressed store
(`sandbox://atlas/models/<blake3-of-bytes>.bin`) and registers it:

```sh
atlas-registryctl register \
  --model models/atlas-mlp-7-2026-04-22.bin \
  --trainer-pubkey-hex <TRAINER> \
  --training-dataset-hash-hex <DATASET> \
  --training-config-hash-hex <CONFIG> \
  --feature-schema-version 7 \
  --feature-schema-hash-hex <SCHEMA> \
  --parent-model-id-hex <PARENT_OR_GENESIS> \
  --ensemble-hash-hex <ENSEMBLE> \
  --created-at-slot <SLOT>
```

The registry verifies `model_id == blake3(model_bytes)` before storing.

## Step 2 — Mandatory sandbox suite (directive §4)

CI gates the `Draft → Audited` transition on:

1. **90-day historical replay** across at least three regimes
   (bull, chop, drawdown). Run via `atlas-sandbox backtest` with three
   distinct `--slot-range`s; record reports.
2. **Chaos suite (Phase 08)** — oracle drift, liquidity vanish,
   volatility shock, RPC split, stale-proof replay.
3. **A/B compare** vs the currently-approved model:
   `atlas-sandbox compare --a <approved.json> --b <candidate.json>`. The
   delta on the vault's primary objective must be either statistically
   significant positive or equivalent within tolerance (CI brackets 0).
4. **Leakage probe** — random feature shuffle test. Shuffled-time MAE
   must collapse to baseline. The probe reports `LeakageKind::ShuffleProbeFailed`
   when the model didn't actually use the time axis.
5. **Determinism check** — 5 independent runs must produce
   byte-identical `BacktestReport`s. The CI driver hashes
   `serde_json::to_vec(&report)` of each and asserts equality.

Failure on any of these halts the flow.

## Step 3 — Audit

A non-trainer auditor reviews the sandbox suite outputs and the static
training-config TOML, signs a report digest, and submits the verdict:

```sh
atlas-registryctl audit \
  --model-id-hex <MODEL_ID> \
  --auditor-pubkey-hex <AUDITOR> \
  --verdict pass \
  --signed-report-hash-hex <REPORT_HASH> \
  --slot <SLOT>
```

A `Pass` verdict transitions the record to `Audited`. A `Fail` keeps it
`Draft`; a `NeedsRevision` is recorded but does not transition status.

## Step 4 — Approval (governance multisig)

Governance signers collect a multisig threshold and call `approve`,
which records the performance summary alongside the status transition
and produces a Bubblegum anchor leaf:

```sh
atlas-registryctl approve \
  --model-id-hex <MODEL_ID> \
  --signer-set-root-hex <SIGNER_SET> \
  --slot <SLOT> \
  --backtest-report-uri sandbox://atlas/reports/<id>.json \
  --sandbox-period-start-slot 250000000 \
  --sandbox-period-end-slot   254320000 \
  --realized-apy-bps 1450 \
  --mwrr-bps 1480 \
  --max-drawdown-bps 320 \
  --defensive-share-bps 480
```

After this, the approved `ensemble_hash` is registered on-chain as a
*candidate* for any vault that opts in. Existing vaults remain bound to
the model committed at creation (Phase 01 I-1).

## Step 5 — Drift monitoring

The drift monitor evaluates each Approved model continuously:

* Predicted vs realised APY MAE (rolling 7d, 30d).
* Defensive trigger frequency vs the backtest baseline.
* Brier score on agent-level confidence.

If any threshold trips, the engine pages governance and the registry
flags the model:

```sh
atlas-registryctl flag-drift \
  --model-id-hex <MODEL_ID> \
  --signer-set-root-hex <SIGNER_SET> \
  --slot <SLOT>
```

Status: `Approved → DriftFlagged`. Recovery is possible (drift clears →
`DriftFlagged → Approved`) or termination (`→ Deprecated` / `→ Slashed`).

## Step 6 — Slashing (security event)

If a model in any active status is later proven to have been trained on
leaked data (provable via the leakage probe in sandbox CI), governance
slashes it. The transition is final:

```sh
atlas-registryctl slash \
  --model-id-hex <MODEL_ID> \
  --signer-set-root-hex <SIGNER_SET> \
  --slot <SLOT>
```

Status: `* → Slashed`. New vaults cannot adopt slashed ensembles. The
alert engine emits a `SecurityEvent` (Phase 05 §4); the on-chain anchor
records the transition irreversibly.

## Anti-patterns (directive §6)

* Approving without a published backtest report URI — `approve` requires
  it as an argument.
* Reusing a sandbox key for production submission —
  `SandboxGuard::require_sandbox_uri` rejects production URIs.
* Skipping the leakage probe because "we know we didn't leak" — CI gates
  the probe.
* Mutating an approved registry entry — the in-memory store and the
  ClickHouse-backed implementation both expose status transitions only.
* Trainer self-audit — both `ModelRecord::validate` and the
  `atlas-registryctl audit` subcommand reject trainer == auditor.

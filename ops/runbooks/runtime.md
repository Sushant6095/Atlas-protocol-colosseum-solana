# Runbook — Solana Runtime (Phase 07)

Covers the lowest layer in the stack — Sealevel parallelism, ALT
discipline, CPI isolation, MEV defense, dual-route bundle keeper.

## Triage cheatsheet

| Symptom | First metric | Page severity |
|---|---|---|
| CU exhaustion (5xxx ComputeExhaustion) | `atlas_runtime_cu_used p99` | Page if hard cap (1.4M) hit |
| CU predicted-vs-used drift > 1500 bps | `atlas_runtime_cu_predicted_vs_used_drift_bps p99` | Notify; investigate stage CU baselines |
| Transaction over 1232 bytes | `atlas_runtime_tx_size_bytes p99` | Page (transaction will hard-reject pre-flight) |
| Bundle atomicity violation | `atlas_runtime_bundle_atomicity_violations_total` | **Page** — security event candidate |
| CPI post-condition violation | `atlas_runtime_cpi_post_condition_violations_total` | **Page** — invariant I-10 tripped |
| ALT miss | `atlas_runtime_alt_misses_total` | Page; bundle composer is referencing an account not in any warm ALT |
| Bundle landed rate < 95 % | `atlas_runtime_bundle_landed_rate_bps{route=...}` | Page if sustained 4h |

## Account write-lock discipline (§1)

- Every ix definition declares its writable accounts. Run
  `atlas_runtime::lints::check_readonly_discipline(ix, declared,
  actually_mutated)` against the program; CI rejects on any unjustified
  writable.
- Per-bundle SLO: `runtime.writable_accounts_per_bundle p99 ≤ 64`. If
  breached, the bundle composer's planner is fanning out beyond the
  minimal CPI write set — diff against the canonical reference
  (`tests/runtime/canonical_writable_set.json`).
- Cross-vault writable collisions are forbidden. The off-chain check
  (`atlas_runtime::locks::lock_collision_set`) runs on every paired
  bundle composition.

## ALT lifecycle (§2)

- **Create**: an ALT is `Pending` until `current_slot >
  created_at_slot + 1`. Reference only `Warm` ALTs.
- **Extend**: chunks of ≤ 30 keys per call (`atlas_alt::extend_chunks`).
  An extension exceeding 30 is a deployment bug.
- **Refresh**: deactivate the old ALT, create a new one. Never edit a
  warm ALT in place.
- **Compaction**: `compaction_candidates(alts)` ranks pairs by
  Jaccard ≥ 80 %. The scheduled job runs daily; operator confirms
  before executing the merge.

## CPI isolation (§4)

Three runtime gates:

1. `is_allowlisted(program_id)` against the 9-program list (Kamino,
   Drift, Jupiter, Marginfi, Token, Token-2022, ATA, Compute Budget,
   Memo). Off-list rejects before `invoke_signed`.
2. `check_owner(pubkey, expected, observed)` for every passed-in
   token / state account. Mismatch is a rebalance abort.
3. `diff_snapshots(pre, post, allowed_fields)` after the CPI; any
   unauthorized lamport / data / owner change is I-10.

## Dual-route bundle keeper (§6)

- **Route A — Jito Block Engine.** Tip from `TipOracle.next_tip(cap)`,
  capped per bundle and per 24h.
- **Route B — SWQoS.** `skipPreflight=true` only after
  Phase 01 §9.4 simulation gate is green.
- **Idempotency.** `bundle_id = blake3(public_input_hash ||
  allocation_root || keeper_nonce)` registered in
  `IdempotencyGuard` before submit; `record_rb` ix asserts
  uniqueness on chain.
- **Region preference.** `RegionEma::best_region(route)` returns the
  highest landed-rate region. EMA `alpha_bps` defaults to 2_000 (0.20
  reactivity).

## MEV detection (§7)

- After every landed bundle, run
  `atlas_mev::compute_exposure_score(block_window)`. The window
  should span ±4 positions around our bundle's `position`.
- `score_bps = pool_overlap_bps × (adjacency+1).clamp(1,8)`. Threshold
  for emitting a `MevAnomaly`: `score_bps ≥ 20_000` AND
  `pool_overlap_bps ≥ 5_000`.
- Anomaly emission goes through the Phase 05 forensic engine
  (`MevAnomaly` is the structured event; the orchestrator wraps it
  into a `ForensicSignal`).

## Anti-patterns (§11)

- **Anchor on the verifier hot path.** Pinocchio only
  (`atlas_verifier`, `atlas_rebalancer`, `atlas_alt_keeper`).
- **Borsh in handlers on hot path.** Run
  `atlas_runtime::lints::lint_no_borsh_on_hot_path` against each
  hot-path crate's `cargo tree` output.
- **`format!` in `msg!` calls.** Only static format strings —
  `lint_disallowed_methods` flags `format!` in handlers.
- **Static tip lamports.** Tip is always `TipOracle.next_tip()`.
- **`Clock::unix_timestamp` in verifier.** Slot only;
  `DeterminismCheck` flags violations across program sources.
- **ALT extension > 30 keys.** Hard caught by
  `atlas_alt::extend_chunks`.
- **`sendTransaction` with `skipPreflight=true` without simulation
  gate.** Route B requires Phase 01 §9.4 green first.

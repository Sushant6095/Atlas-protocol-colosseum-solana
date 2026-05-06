# Programs migration plan — Pinocchio + zero-copy (directive 07 §3)

The on-chain crates under `programs/` live in a separate Cargo workspace
(`solana_workspace/Cargo.toml`) because `sp1-solana` and Anchor 0.32
currently conflict with `sp1-sdk 4`. This document is the migration
playbook for moving the hot-path programs to Pinocchio + zero-copy.

| Program | Current | Target | Why |
|---|---|---|---|
| `atlas-verifier` | Anchor 0.32 | Pinocchio + zero-copy | sp1-solana Groth16 verify ~250k CU; every saved CU matters |
| `atlas-rebalancer` | Anchor 0.32 | Pinocchio + zero-copy | CPI orchestrator; latency- + CU-sensitive |
| `atlas-vault` | Anchor 0.32 | **Anchor stays** | Lower-frequency entrypoint; auditor reading wins over CU |
| `atlas-alt-keeper` | _new_ | Pinocchio | Trivial dispatch, no need for Anchor overhead |
| `atlas-registry` | Anchor 0.32 | **Anchor stays** | Governance UX clarity outweighs CU |

## Per-program deltas

### `atlas-verifier` (Pinocchio)

1. Replace `anchor_lang::prelude::*` with `pinocchio::*`.
2. Convert `#[program]` entrypoint to a manual
   `entrypoint!(process_instruction)` dispatch on the first byte of
   `instruction_data`.
3. Replace `Account<T>` with `bytemuck::cast_ref::<T, [u8; SIZE]>` on
   the raw `AccountInfo.data`. Add a per-account `assert_pod_layout`
   test (`atlas_runtime::zero_copy::assert_pod_layout`).
4. Keep the public input layout (Phase 01) byte-for-byte identical;
   the verifier reads it from the price account written by Pyth, not
   from a Borsh-decoded struct.
5. Replace any `format!` / `String` allocations with `msg!` static
   format strings (`atlas_runtime::lints::lint_disallowed_methods`
   pinned).
6. Bench gate: 250k CU baseline (`bench/baseline.json`); regression >
   5 % fails the merge.

### `atlas-rebalancer` (Pinocchio + CPI guard)

1. Same Pinocchio scaffolding.
2. Wire the `atlas-cpi-guard` crate's runtime checks before every
   `invoke_signed`:
   - `is_allowlisted(target)` — reject off-list ids.
   - `check_owner(pubkey, expected, observed)` — pre-CPI re-derivation.
   - `snapshot(...)` for every Atlas-owned writable; after the CPI,
     `diff_snapshots(pre, post, allowed_fields)` and revert on any
     `SnapshotDiffViolation`.
3. ALT discipline: refuse to assemble a tx referencing accounts not
   present in the declared lookup tables (`atlas_runtime::ALT misses`
   metric goes 0).
4. Slippage tighteners: re-check observed slippage after every swap
   CPI; revert if `observed_bps > committed_bps`.

### `atlas-alt-keeper` (Pinocchio, new program)

1. PDA-controlled authority over the ALTs. Two ixs:
   `create_lookup_table` + `extend_lookup_table` — the latter caps
   inputs at 30 keys per call (`atlas_alt::EXTEND_CHUNK_LIMIT`).
2. Refresh path: never edits a warm ALT; creates a new one and
   deactivates the old.
3. Compaction: a scheduled keeper-side job runs
   `atlas_alt::compaction_candidates`; merges go through
   `create_lookup_table` + `extend_chunks`.

### `atlas-vault` (stays Anchor)

1. Add `record_rb` ix that asserts uniqueness of `bundle_id` against
   a sliding ring buffer of recent ids (`atlas_bundle::IdempotencyGuard`
   shape — on-chain it's a fixed-size array in zero-copy state).
2. Add the receipt-tree root commitment field; updated atomically with
   the rebalance per directive §5.3.
3. Vault state remains zero-copy where it already was.

## Sequencing

1. Land `atlas-alt-keeper` first — it has no dependents and exercises
   the Pinocchio scaffolding end-to-end.
2. `atlas-verifier` next — the largest CU win; benchmarks pin the
   improvement.
3. `atlas-rebalancer` last — it depends on the CPI-guard crate behavior
   being identical pre/post migration. Diff its CU baselines before
   the cutover so any regression is visible.

## CI

- Mollusk benchmarks live under `programs/bench/`. Per-PR CI runs
  `atlas-bench-check --baseline programs/bench/baseline.json
  --observations <run>.json` and exits non-zero on any > 5 %
  regression.
- Lint passes:
  - `atlas_runtime::lints::lint_no_borsh_on_hot_path` against the
    cargo-tree of `atlas-verifier`, `atlas-rebalancer`,
    `atlas-alt-keeper`.
  - `atlas_runtime::lints::lint_disallowed_methods` over each
    program's source files.
  - `atlas_runtime::determinism::DeterminismCheck` over the verifier
    sources.

## Tracking

Open issues in the program tracker, one per program:

- [ ] verifier-pinocchio
- [ ] rebalancer-pinocchio
- [ ] alt-keeper-new
- [ ] vault-record-rb
- [ ] vault-receipt-root-commitment

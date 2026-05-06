# Bubblegum Anchor Keeper — Operations Runbook

This runbook governs the dedicated keeper that anchors warehouse Merkle
roots on-chain via SPL Account Compression (Bubblegum). It is the
cryptographic bridge between Atlas's off-chain archive and the on-chain
public-record contract.

## On-chain account inventory

| Account | Owner | Derivation | Purpose |
|---|---|---|---|
| `atlas_archive_tree` | `mpl-bubblegum` | seed `[b"atlas-archive", vault_namespace]` | Compressed Merkle tree storing leaf hashes of accepted-rebalance receipts. |
| `atlas_archive_authority` | `atlas_registry` program | seed `[b"atlas-archive-authority"]` | PDA that owns tree mutation; the keeper key is the only signer authorized to invoke `append_leaf`. |
| `atlas_keeper` | system | dedicated hot wallet, narrow scope | Submits the `append_leaf` ixs; never holds vault funds. |
| `atlas_keeper_bond` | `atlas_registry` program | seed `[b"atlas-keeper-bond", keeper.pubkey]` | Token-2022 escrow for the keeper's slashable stake. |

The keeper key is **not** a multisig. Directive §9 anti-pattern:
*"Anchoring Bubblegum roots from a multisig-controlled keeper. Use a dedicated,
narrowly-scoped keeper key with a slashing-style policy."*

## Keeper duties

1. Subscribe to the `BubblegumAnchorReceipt` channel emitted by
   `BubblegumFlusher` (Phase 03 — `crates/atlas-warehouse/src/flusher.rs`).
2. For each receipt, build a `mpl_bubblegum::cpi::append` instruction with the
   receipt's `batch_root` as the leaf.
3. Submit the ix in a Versioned Transaction with the keeper key as the
   single signer plus `atlas_archive_authority` as a CPI-signing PDA.
4. Confirm the tx; on success update the warehouse with the on-chain leaf
   index. On failure, retry with exponential backoff up to a per-receipt
   deadline.

## Slashing policy

The keeper has only one job: append the next anchor receipt before the
SLO deadline (`bubblegum_anchor_lag_slots ≤ 600`). Failures are slashable:

| Condition | Detection | Slash |
|---|---|---|
| Anchor receipt lag > 600 slots from `slot_high` | `WAREHOUSE_BUBBLEGUM_ANCHOR_LAG_SLOTS` p99 alert | 5% of bond, weekly cap 25% |
| Anchor never lands (lag > 7200 slots) | Watchdog program comparison vs. flusher channel | 100% bond, key revoked |
| Keeper anchored a leaf that does not match the off-chain receipt | Auditor-driven challenge using `find_proof_for_receipt` + on-chain proof | 100% bond, key revoked |
| Keeper submits a duplicate leaf within 32 slots | On-chain duplicate-leaf detector | 25% bond per occurrence |

Bond minimum: 1000 USDG. Bond is held in `atlas_keeper_bond` Token-2022
account; slashing CPIs into that account from `atlas_registry`.

## Rotation procedure

Routine rotation (no incident):

1. Provision new keeper key offline.
2. Stake bond to `atlas_keeper_bond[new_keeper]`.
3. Pause the flusher consumer; confirm `pending_len == 0` then stop the keeper.
4. Update the `atlas_archive_authority` PDA's whitelist via
   `atlas_registry::rotate_archive_keeper`.
5. Restart the keeper with the new key; confirm one anchor lands within
   60 seconds.
6. Wait 7 days, then withdraw the old keeper's bond.

Emergency rotation (suspected key compromise):

1. Page security oncall.
2. Multisig invokes `atlas_registry::revoke_archive_keeper` immediately —
   this stops appends until a new keeper is whitelisted.
3. Slash the entire bond of the compromised keeper.
4. Provision and whitelist a new keeper following routine steps 1, 2, 4–6.
5. Trigger an audit-initiated `find_proof_for_receipt` sweep against the
   last 24 hours of receipts to confirm no rogue leaves landed.

## Monitoring

| Signal | Source | Threshold |
|---|---|---|
| `atlas_warehouse_bubblegum_anchor_lag_slots` | Prometheus | p99 ≤ 600 (warn 400) |
| `atlas_warehouse_archive_failure_total{table="rebalances"}` | Prometheus | hard alert on any |
| Keeper bond balance | RPC poll on `atlas_keeper_bond` | warn < 80% of minimum |
| Keeper key signing failures | log scrape | warn > 0/5min |
| Tree append success rate | RPC tx subscribe | warn < 99.9% / 1h |

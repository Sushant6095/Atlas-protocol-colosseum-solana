# Atlas Warehouse — Restore Runbook

This runbook covers daily backups, monthly restore drills, and disaster recovery
for the intelligence warehouse described in Phase 03.

## Architecture recap

| Tier | Engine | Retention | Storage |
|---|---|---|---|
| Hot | TimescaleDB | 30 days | NVMe |
| Warm | ClickHouse | 18 months | SSD |
| Cold | S3 (or R2 / B2) | indefinite | object lock |
| Cryptographic anchor | Bubblegum compressed merkle on Solana | indefinite | on-chain root |

The Bubblegum anchor is the **source of truth**. Hot/warm/cold can all be
rebuilt from the cold tier; the cold tier itself is verified against the
on-chain root before anything is trusted.

---

## Daily backup schedule

Cron at 02:00 UTC, run from a backup-only host with read replicas:

| Step | Command | Where |
|---|---|---|
| 1 | `pg_dump --format=directory --file=/backup/timescale/$(date -I) -d atlas` | hot tier replica |
| 2 | `clickhouse-backup create_remote daily-$(date -I)` | warm tier replica |
| 3 | `aws s3 sync s3://atlas-events s3://atlas-events-backup` | cold tier mirror |
| 4 | Snapshot the Bubblegum anchor account list onchain → write metadata to `s3://atlas-events-backup/anchors/$(date -I).json` | onchain reader |
| 5 | Verify checksum manifest against the previous day's manifest; alert oncall on diff outside expected delta | backup-only host |

Retention: 14 daily backups online, monthlies archived to glacier indefinitely.

---

## Monthly restore drill

The first business day of every month, oncall executes a restore drill into a
sandbox cluster and asserts:

1. The restored ClickHouse + Timescale match the cold tier byte-for-byte for the
   target window.
2. `atlas-bus-replay --slot-range <one_day> --archive <restored_path>` returns
   `replay_parity: true` against the production replay-parity baseline recorded
   on the same day.
3. The Bubblegum anchor at `archive_root_slot` (taken from the live forensic
   API) verifies via `verify_path` for ten randomly-chosen
   `public_input_hash`es from the restored data set.

Drill is scored pass/fail and recorded in `ops/runbooks/restore-drill-log.md`.

---

## Disaster recovery procedure

### 1. Verify cryptographic integrity first

Before restoring anything to a production cluster, fetch the latest Bubblegum
anchor from the live chain and confirm the cold tier's Merkle roots agree with
it. If they do not agree, **stop**. Do not restore. Page the security oncall.

```bash
atlas-warehouse-tools verify-cold \
  --cold s3://atlas-events-backup \
  --bubblegum-account <ACCOUNT_PUBKEY>
```

### 2. Bring up Timescale

```bash
pg_restore --clean --create -d postgres /backup/timescale/$(date -I)
psql -d atlas -f db/timescale/V001__base_schema.sql
```

### 3. Bring up ClickHouse

```bash
clickhouse-backup restore_remote daily-$(date -I)
clickhouse-client < db/clickhouse/V001__base_schema.sql
```

### 4. Re-replay events from cold tier into bus

```bash
atlas-bus-replay \
  --slot-range <recovery_lo>..<recovery_hi> \
  --archive s3://atlas-events-backup
```

Assert `replay_parity: true` before allowing the orchestrator to consume from
the rebuilt warehouse.

### 5. Anchor a fresh batch

After verification, push a fresh Bubblegum anchor over the recovered batch so
auditors can prove "this is the canonical archive after recovery".

---

## Anti-patterns

- Restoring without verifying against the on-chain anchor first.
- Running a restore on the live production cluster without first proving the
  drill on the sandbox.
- Skipping the replay-parity assertion. If the rebuilt warehouse cannot
  reproduce the recorded triggers, it is corrupt — do not promote it.
- Treating Timescale or ClickHouse as authoritative. The cold tier + Bubblegum
  root is authoritative. Hot/warm are caches.

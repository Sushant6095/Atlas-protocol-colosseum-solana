-- Atlas warehouse — ClickHouse base schema (V001).
-- Authoritative tables per directive 03 §2.
-- Migration runner: see ops/runbooks/warehouse-restore.md.

CREATE DATABASE IF NOT EXISTS atlas;

-- 2.1 rebalances
CREATE TABLE IF NOT EXISTS atlas.rebalances (
    slot                UInt64,
    vault_id            FixedString(32),
    public_input_hash   FixedString(32),
    proof_blob_uri      String,
    explanation_hash    FixedString(32),
    explanation_json    String CODEC(ZSTD(3)),
    feature_root        FixedString(32),
    consensus_root      FixedString(32),
    risk_state_hash     FixedString(32),
    allocation_root     FixedString(32),
    allocation_bps      Array(UInt32),
    agent_proposals_uri String,
    ingest_quorum_n     UInt8,
    defensive_mode      UInt8,
    tx_signature        FixedString(64),
    landed_slot         Nullable(UInt64),
    bundle_id           FixedString(32),
    prover_id           FixedString(32),
    proof_gen_ms        UInt32,
    e2e_ms              UInt32,
    status              Enum8('proposed'=0,'submitted'=1,'landed'=2,'rejected'=3,'aborted'=4)
)
ENGINE = ReplacingMergeTree(slot)
ORDER BY (vault_id, slot, public_input_hash)
SETTINGS index_granularity = 8192;

-- 2.3 oracle_ticks
CREATE TABLE IF NOT EXISTS atlas.oracle_ticks (
    slot                          UInt64,
    feed_id                       UInt32,
    source                        Enum8('pyth'=0,'switchboard'=1,'dex_twap'=2),
    price_q64                     Int64,
    conf_q64                      UInt64,
    publish_slot                  UInt64,
    deviation_bps_vs_consensus    Int32
)
ENGINE = MergeTree()
ORDER BY (feed_id, slot, source)
TTL toDateTime(now()) + INTERVAL 540 DAY DELETE
SETTINGS index_granularity = 8192;

-- 2.4 pool_snapshots
CREATE TABLE IF NOT EXISTS atlas.pool_snapshots (
    slot              UInt64,
    pool              FixedString(32),
    protocol          FixedString(32),
    depth_minus1pct   UInt64,
    depth_plus1pct    UInt64,
    tvl_q64           Int128,
    util_bps          UInt32,
    snapshot_hash     FixedString(32)
)
ENGINE = MergeTree()
ORDER BY (pool, slot);

-- 2.5 agent_proposals
CREATE TABLE IF NOT EXISTS atlas.agent_proposals (
    rebalance_id        FixedString(32),
    agent_id            UInt8,
    allocation_bps      Array(UInt32),
    confidence_bps      UInt32,
    veto                UInt8,
    rejection_reasons   Array(String),
    reasoning_hash      FixedString(32)
)
ENGINE = MergeTree()
ORDER BY (rebalance_id, agent_id);

-- 2.6 events (raw replay log)
CREATE TABLE IF NOT EXISTS atlas.events (
    slot               UInt64,
    source             UInt8,
    epoch              UInt64,
    event_id           FixedString(32),
    canonical_bytes    String CODEC(ZSTD(6))
)
ENGINE = MergeTree()
PARTITION BY (source, epoch)
ORDER BY (event_id);

-- 2.7 failure_classifications
CREATE TABLE IF NOT EXISTS atlas.failure_classifications (
    slot                UInt64,
    vault_id            FixedString(32),
    stage               String,
    class               String,
    code                UInt32,
    message_hash        FixedString(32),
    remediation_id      Nullable(String),
    recovered_at_slot   Nullable(UInt64)
)
ENGINE = MergeTree()
ORDER BY (vault_id, slot, stage);

-- ─── Materialized views (directive §4) ─────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.mv_rebalance_summary_daily
ENGINE = SummingMergeTree()
ORDER BY (day, vault_id, status)
POPULATE
AS SELECT
    toStartOfDay(toDateTime(slot * 0.4)) AS day,
    vault_id,
    status,
    count() AS n,
    avg(e2e_ms) AS avg_e2e_ms,
    avg(proof_gen_ms) AS avg_proof_gen_ms
FROM atlas.rebalances
GROUP BY day, vault_id, status;

CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.mv_agent_disagreement_distribution
ENGINE = MergeTree()
ORDER BY (rebalance_id, bucket)
POPULATE
AS SELECT
    rebalance_id,
    intDiv(confidence_bps, 500) AS bucket,
    count() AS n
FROM atlas.agent_proposals
GROUP BY rebalance_id, bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.mv_failure_class_rate
ENGINE = SummingMergeTree()
ORDER BY (hour, vault_id, class)
POPULATE
AS SELECT
    toStartOfHour(toDateTime(slot * 0.4)) AS hour,
    vault_id,
    class,
    count() AS n
FROM atlas.failure_classifications
GROUP BY hour, vault_id, class;

CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.mv_protocol_exposure_over_time
ENGINE = MergeTree()
ORDER BY (vault_id, slot, protocol_index)
POPULATE
AS SELECT
    vault_id,
    slot,
    arrayJoin(arrayEnumerate(allocation_bps)) AS protocol_index,
    allocation_bps[protocol_index] AS bps
FROM atlas.rebalances;

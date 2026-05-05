-- Atlas warehouse — TimescaleDB base schema (V001).
-- Hot tier; 30-day retention. Authoritative tables per directive 03 §2.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE SCHEMA IF NOT EXISTS atlas;

-- 2.1 rebalances (hot mirror; ClickHouse owns warm tier)
CREATE TABLE IF NOT EXISTS atlas.rebalances (
    slot                BIGINT       NOT NULL,
    vault_id            BYTEA        NOT NULL,
    public_input_hash   BYTEA        NOT NULL,
    proof_blob_uri      TEXT         NOT NULL,
    explanation_hash    BYTEA        NOT NULL,
    explanation_json    JSONB        NOT NULL,
    feature_root        BYTEA        NOT NULL,
    consensus_root      BYTEA        NOT NULL,
    risk_state_hash     BYTEA        NOT NULL,
    allocation_root     BYTEA        NOT NULL,
    allocation_bps      INTEGER[]    NOT NULL,
    agent_proposals_uri TEXT         NOT NULL,
    ingest_quorum_n     SMALLINT     NOT NULL,
    defensive_mode      BOOLEAN      NOT NULL,
    tx_signature        BYTEA        NOT NULL,
    landed_slot         BIGINT,
    bundle_id           BYTEA        NOT NULL,
    prover_id           BYTEA        NOT NULL,
    proof_gen_ms        INTEGER      NOT NULL,
    e2e_ms              INTEGER      NOT NULL,
    status              TEXT         NOT NULL,
    PRIMARY KEY (vault_id, slot, public_input_hash)
);

SELECT create_hypertable('atlas.rebalances', 'slot', if_not_exists => true, chunk_time_interval => 86400);

-- 2.2 account_states (Timescale primary)
CREATE TABLE IF NOT EXISTS atlas.account_states (
    slot              BIGINT  NOT NULL,
    pubkey            BYTEA   NOT NULL,
    owner             BYTEA   NOT NULL,
    lamports          BIGINT  NOT NULL,
    data_hash         BYTEA   NOT NULL,
    data_zstd         BYTEA   NOT NULL,
    source            SMALLINT NOT NULL,
    observed_at_slot  BIGINT  NOT NULL,
    PRIMARY KEY (pubkey, slot)
);

SELECT create_hypertable('atlas.account_states', 'slot', if_not_exists => true, chunk_time_interval => 1024);
SELECT add_compression_policy('atlas.account_states', INTERVAL '6 hours', if_not_exists => true);
SELECT add_retention_policy('atlas.account_states', INTERVAL '30 days', if_not_exists => true);

-- 2.6 events (replay log mirror)
CREATE TABLE IF NOT EXISTS atlas.events (
    slot              BIGINT NOT NULL,
    source            SMALLINT NOT NULL,
    epoch             BIGINT NOT NULL,
    event_id          BYTEA  NOT NULL,
    canonical_bytes   BYTEA  NOT NULL,
    PRIMARY KEY (event_id)
);

SELECT create_hypertable('atlas.events', 'slot', if_not_exists => true, chunk_time_interval => 86400);
SELECT add_compression_policy('atlas.events', INTERVAL '24 hours', if_not_exists => true);
SELECT add_retention_policy('atlas.events', INTERVAL '30 days', if_not_exists => true);

CREATE INDEX IF NOT EXISTS idx_rebalances_vault_slot ON atlas.rebalances (vault_id, slot DESC);
CREATE INDEX IF NOT EXISTS idx_account_states_pubkey_slot ON atlas.account_states (pubkey, slot DESC);
CREATE INDEX IF NOT EXISTS idx_events_slot_source ON atlas.events (slot, source);

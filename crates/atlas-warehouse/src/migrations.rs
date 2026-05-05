//! Migration metadata.
//!
//! `TABLE_VERSIONS` is the canonical record of the deployed schema. Adding a
//! column to any row struct in `schema.rs` requires bumping the corresponding
//! entry here AND landing a `db/<engine>/V<NNN>__*.sql` migration. CI fails
//! if the row struct and `TABLE_VERSIONS` drift.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TableVersion {
    pub table: &'static str,
    pub version: u32,
    pub engine: Engine,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Engine {
    ClickHouse,
    TimescaleDB,
    Both,
}

pub const TABLE_VERSIONS: &[TableVersion] = &[
    TableVersion { table: "rebalances", version: 1, engine: Engine::Both },
    TableVersion { table: "account_states", version: 1, engine: Engine::TimescaleDB },
    TableVersion { table: "oracle_ticks", version: 1, engine: Engine::Both },
    TableVersion { table: "pool_snapshots", version: 1, engine: Engine::Both },
    TableVersion { table: "agent_proposals", version: 1, engine: Engine::ClickHouse },
    TableVersion { table: "events", version: 1, engine: Engine::Both },
    TableVersion { table: "failure_classifications", version: 1, engine: Engine::ClickHouse },
];

pub fn version_for(table: &str) -> Option<u32> {
    TABLE_VERSIONS.iter().find(|v| v.table == table).map(|v| v.version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_directive_table_has_a_version() {
        for t in [
            "rebalances",
            "account_states",
            "oracle_ticks",
            "pool_snapshots",
            "agent_proposals",
            "events",
            "failure_classifications",
        ] {
            assert!(version_for(t).is_some(), "missing migration for {t}");
        }
    }

    #[test]
    fn unknown_table_returns_none() {
        assert!(version_for("unknown").is_none());
    }
}

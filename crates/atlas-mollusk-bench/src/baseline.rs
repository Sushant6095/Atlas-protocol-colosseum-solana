//! Baseline registry — `(program, ix) -> baseline_cu`.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Baseline {
    pub program: String,
    pub ix: String,
    pub baseline_cu: u32,
    /// Optional human note on why the number is what it is — referenced
    /// by reviewers when the baseline is updated.
    pub note: Option<String>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BaselineDbError {
    #[error("duplicate baseline for (program={program}, ix={ix})")]
    Duplicate { program: String, ix: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct BaselineDb {
    /// Sorted by `(program, ix)`. Vec rather than map so the on-disk
    /// JSON shape is a flat array — diffs in PRs read naturally.
    pub entries: Vec<Baseline>,
}

impl BaselineDb {
    pub fn new() -> Self { Self::default() }

    pub fn insert(&mut self, b: Baseline) -> Result<(), BaselineDbError> {
        if self.entries.iter().any(|x| x.program == b.program && x.ix == b.ix) {
            return Err(BaselineDbError::Duplicate {
                program: b.program.clone(),
                ix: b.ix.clone(),
            });
        }
        self.entries.push(b);
        self.entries.sort_by(|a, b| (a.program.clone(), a.ix.clone()).cmp(&(b.program.clone(), b.ix.clone())));
        Ok(())
    }

    pub fn get(&self, program: &str, ix: &str) -> Option<&Baseline> {
        self.entries.iter().find(|b| b.program == program && b.ix == ix)
    }

    pub fn from_json(bytes: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn b(program: &str, ix: &str, cu: u32) -> Baseline {
        Baseline { program: program.into(), ix: ix.into(), baseline_cu: cu, note: None }
    }

    #[test]
    fn insert_and_lookup() {
        let mut db = BaselineDb::new();
        db.insert(b("atlas_verifier", "verify", 250_000)).unwrap();
        db.insert(b("atlas_rebalancer", "execute", 600_000)).unwrap();
        assert_eq!(db.get("atlas_verifier", "verify").unwrap().baseline_cu, 250_000);
        assert!(db.get("atlas_unknown", "foo").is_none());
    }

    #[test]
    fn duplicate_insert_rejects() {
        let mut db = BaselineDb::new();
        db.insert(b("atlas_verifier", "verify", 250_000)).unwrap();
        assert!(matches!(
            db.insert(b("atlas_verifier", "verify", 240_000)),
            Err(BaselineDbError::Duplicate { .. })
        ));
    }

    #[test]
    fn json_round_trip() {
        let mut db = BaselineDb::new();
        db.insert(b("atlas_verifier", "verify", 250_000)).unwrap();
        let bytes = serde_json::to_vec(&db).unwrap();
        let back = BaselineDb::from_json(&bytes).unwrap();
        assert_eq!(db, back);
    }
}

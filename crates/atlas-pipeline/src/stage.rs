//! `Stage` trait — every pipeline step implements this.
//!
//! Contract:
//!   - `Stage::run` is the live (network-touching) implementation.
//!   - `Stage::replay` reads from the archival store; never hits the network.
//!   - Both produce byte-identical outputs given the same input (idempotent).
//!   - Both record an OTel span via `record_span`. Span name = stage id.

use crate::ctx::PipelineCtx;

#[derive(Debug, thiserror::Error)]
pub enum StageError {
    #[error("upstream RPC quorum disagreement on stage `{stage}`: {detail}")]
    QuorumDisagreement { stage: &'static str, detail: String },

    #[error("oracle deviation exceeded on stage `{stage}`: {detail}")]
    OracleDeviation { stage: &'static str, detail: String },

    #[error("missing archival entry for slot {slot} on stage `{stage}` in replay mode")]
    MissingArchival { stage: &'static str, slot: u64 },

    #[error("invariant violation on stage `{stage}`: {detail}")]
    InvariantViolation { stage: &'static str, detail: String },

    #[error("upstream IO failure on stage `{stage}`: {source}")]
    Io {
        stage: &'static str,
        #[source]
        source: anyhow::Error,
    },

    #[error("stage `{stage}` returned non-deterministic output (replay mismatch)")]
    DeterminismFailure { stage: &'static str },
}

#[async_trait::async_trait]
pub trait Stage: Send + Sync {
    /// Stable identifier — used as OTel span name and metric prefix.
    /// Format: `01-ingest-state`, `03-extract-features`, …
    const ID: &'static str;

    type Input: Send + Sync;
    type Output: Send + Sync;

    /// Live execution. May touch network, but every external call must have a
    /// declared deadline and quorum policy. Default substitutions are banned.
    async fn run(
        &self,
        ctx: &PipelineCtx,
        input: Self::Input,
    ) -> Result<Self::Output, StageError>;

    /// Replay: reconstruct the same output from the archival store.
    /// Default impl returns `MissingArchival` — every Stage is required to override
    /// this when it produces an archived artifact (stages 01–14).
    async fn replay(
        &self,
        ctx: &PipelineCtx,
        _input: Self::Input,
    ) -> Result<Self::Output, StageError> {
        Err(StageError::MissingArchival {
            stage: Self::ID,
            slot: ctx.slot,
        })
    }
}

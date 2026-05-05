//! Stage implementations.
//!
//! ```text
//! 01 IngestState        → MultiRpcSnapshot          (ingest.rs)
//! 02 NormalizeMarket    → MarketView                (TODO Phase 2)
//! 03 ExtractFeatures    → FeatureVector + lineage   (features.rs)
//! 04 PreprocessRisk     → RiskTopology              (risk.rs)
//! 05 EvaluateAgents     → Vec<AgentProposal>        (agents.rs)
//! 06 ResolveConsensus   → ConsensusOutcome          (consensus.rs)
//! 07 EnforceConstraints → ConstrainedAllocation     (TODO Phase 2)
//! 08 GenerateAllocation → AllocationVectorBps       (allocation.rs)
//! 09 ExplainDecision    → StructuredExplanation     (explanation.rs)
//! 10 SerializeCanonical → PublicInputBytes          (serialize.rs)
//! 11 ProveSp1           → Groth16Proof              (TODO Phase 2)
//! 12 PlanExecution      → CpiPlan                   (planning.rs)
//! 13 SynthesizeTx       → VersionedTransaction[]    (planning.rs::segment_plan)
//! 14 SimulateExecution  → SimulationReport          (simulate.rs)
//! 15 SubmitBundle       → JitoBundleReceipt         (TODO Phase 3)
//! 16 ArchiveTelemetry   → ArchivalReceipt           (TODO Phase 3)
//! ```

pub mod ingest;
pub mod features;
pub mod agents;
pub mod consensus;
pub mod risk;
pub mod allocation;
pub mod explanation;
pub mod planning;
pub mod simulate;
pub mod serialize;

//! Stage implementations.
//!
//! ```text
//! 01 IngestState        → MultiRpcSnapshot          (ingest.rs)
//! 02 NormalizeMarket    → MarketView                (TODO Phase 2)
//! 03 ExtractFeatures    → FeatureVector + lineage   (features.rs — extended)
//! 04 PreprocessRisk     → RiskTopology              (TODO Phase 2)
//! 05 EvaluateAgents     → Vec<AgentProposal>        (agents.rs)
//! 06 ResolveConsensus   → ConsensusOutcome          (consensus.rs)
//! 07 EnforceConstraints → ConstrainedAllocation     (TODO Phase 2)
//! 08 GenerateAllocation → AllocationVectorBps       (allocation.rs)
//! 09 ExplainDecision    → StructuredExplanation     (TODO Phase 2)
//! 10 SerializeCanonical → PublicInputBytes          (serialize.rs)
//! 11 ProveSp1           → Groth16Proof              (TODO Phase 2)
//! 12 PlanExecution      → CpiPlan                   (TODO Phase 3)
//! 13 SynthesizeTx       → VersionedTransaction[]    (TODO Phase 3)
//! 14 SimulateExecution  → SimulationReport          (TODO Phase 3)
//! 15 SubmitBundle       → JitoBundleReceipt         (TODO Phase 3)
//! 16 ArchiveTelemetry   → ArchivalReceipt           (TODO Phase 3)
//! ```

pub mod ingest;
pub mod features;
pub mod agents;
pub mod consensus;
pub mod allocation;
pub mod serialize;

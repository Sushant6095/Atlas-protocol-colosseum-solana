// @atlas/viz — Atlas custom visualization primitives (Phase 24 §1).
//
// Every component takes typed data + typed config (no 30-prop options
// bag). Themes resolve through CSS variables published by the host
// app's `tokens.ts`. Each component carries an `aria-describedby`
// pointer + a `dataTable` slot for the WCAG 2.2 AA "show data table"
// affordance.
//
// Performance budgets per component live in their JSDoc + Storybook.

export { RadialLiquidityMap, type RadialLiquidityMapProps, type RadialSegment } from "./RadialLiquidityMap.js";
export { SankeyFlow,         type SankeyFlowProps,         type SankeyNode, type SankeyEdge } from "./SankeyFlow.js";
export { ProofPipeline,      type ProofPipelineProps,      PROOF_STAGES } from "./ProofPipeline.js";
export { DependencyGraph,    type DependencyGraphProps,    type GraphNode, type GraphEdge } from "./DependencyGraph.js";
export { SlotDriftHeatmap,   type SlotDriftHeatmapProps,   type DriftCell } from "./SlotDriftHeatmap.js";
export { RiskRadar,          type RiskRadarProps,          type RadarAxis } from "./RiskRadar.js";
export { ZkLattice,          type ZkLatticeProps } from "./ZkLattice.js";
export { Globe,              type GlobeProps,              type GlobeMarker } from "./Globe.js";
export { MerkleTreeViewer,   type MerkleTreeViewerProps,   type MerkleStep } from "./MerkleTreeViewer.js";
export { RebalanceTicker,    type RebalanceTickerProps,    type TickerEvent } from "./RebalanceTicker.js";
export { KpiTile, DeltaTile, MonoNumber } from "./tiles.js";

export { vizColor, vizFont, vizDuration } from "./tokens.js";

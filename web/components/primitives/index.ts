// Atlas component primitives — Phase 20 §1, §2.
//
// These are the only leaf components an app surface should reach
// for. Adding a primitive here is a deliberate decision; don't
// shadow them in a feature directory.

export { cn } from "./cn";
export { Panel, type PanelProps } from "./Panel";
export { Button, type ButtonProps } from "./Button";
export { IdentifierMono, type IdentifierMonoProps } from "./IdentifierMono";
export { Identifier, type IdentifierProps } from "./Identifier";
export { AlertPill, type AlertSeverity, type AlertPillProps } from "./AlertPill";
export { StatusPill, type StatusPillProps, type StatusVariant } from "./StatusPill";
export { Tile, type TileProps } from "./Tile";
export { MonoNumber, type MonoNumberProps } from "./MonoNumber";
export { KpiTile, type KpiTileProps } from "./KpiTile";
export { CodeBlock, type CodeBlockProps } from "./CodeBlock";
export { Skeleton, type SkeletonBaseProps } from "./Skeleton";
export { ProofBadge, type ProofBadgeProps, type ProofVariant } from "./ProofBadge";
export { AtlasMark, type AtlasMarkProps, type AtlasMarkVariant, type AtlasMarkSize } from "./AtlasMark";
export { PleiadesIcon, type PleiadesIconProps } from "./PleiadesIcon";
export {
  ProtocolIcon, PROTOCOL_LABELS,
  type ProtocolIconProps, type ProtocolSlug, type ProtocolIconSize,
} from "./ProtocolIcon";

// Phase 24 primitives.
export { Tooltip, type TooltipProps } from "./Tooltip";
export {
  ToastProvider, useToast, toastKeyframes,
  type ToastTone, type ToastInput,
} from "./Toast";
export { AnimatedNumber, type AnimatedNumberProps } from "./AnimatedNumber";
export { DataTable, type DataTableProps, type DataColumn } from "./DataTable";
export {
  CommandPalette, type CommandPaletteProps, type CommandItem,
} from "./CommandPalette";
export {
  Diagram, type DiagramProps, type DiagramNode, type DiagramEdge, type NodeTone,
} from "./Diagram";
export { LineChart, type LineChartProps, type LinePoint } from "./LineChart";
export { DonutChart, type DonutChartProps, type DonutDatum } from "./DonutChart";
export {
  AllocationBadge, type AllocationBadgeProps, type AllocationTone,
} from "./AllocationBadge";
export { PhonePreview, type PhonePreviewProps } from "./PhonePreview";
export { WalletButton, type WalletButtonProps } from "./WalletButton";

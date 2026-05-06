// Atlas component primitives — Phase 20 §1, §2.
//
// These are the only leaf components an app surface should reach
// for. Adding a primitive here is a deliberate decision; don't
// shadow them in a feature directory.

export { cn } from "./cn";
export { Panel, type PanelProps } from "./Panel";
export { Button, type ButtonProps } from "./Button";
export { IdentifierMono, type IdentifierMonoProps } from "./IdentifierMono";
export { AlertPill, type AlertSeverity, type AlertPillProps } from "./AlertPill";
export { Tile, type TileProps } from "./Tile";

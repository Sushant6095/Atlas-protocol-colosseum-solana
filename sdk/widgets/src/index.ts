// @atlas/widgets — embeddable infra widgets (Phase 17 §4.3).
//
// Each widget is a tiny vanilla module: pass a host element and a
// base URL, get a live-updating panel. Same data the public /infra
// page renders, lower-chrome render. No React dependency required;
// a thin React wrapper is also exported for partners using React.

export { renderFreshnessWidget } from "./freshness.js";
export { renderRpcLatencyWidget } from "./rpc-latency.js";
export { renderProofGenWidget } from "./proof-gen.js";
export { renderBundleLandedWidget } from "./bundle-landed.js";
export { renderTpsWidget } from "./tps.js";
export { renderLastRebalanceWidget } from "./last-rebalance.js";
export { renderProofOfReserveWidget } from "./proof-of-reserve.js";
export { iframeUrl } from "./iframe.js";
export { defineAtlasWidget, type AtlasWidgetKind } from "./web-component.js";

export type WidgetTheme = "dark" | "light";

export interface WidgetConfig {
  baseUrl: string;
  refreshIntervalMs?: number;
  theme?: WidgetTheme;
}

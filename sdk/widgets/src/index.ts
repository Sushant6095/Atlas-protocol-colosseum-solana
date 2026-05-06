// @atlas/widgets — embeddable infra widgets (Phase 17 §4.3).
//
// Each widget is a tiny vanilla module: pass a host element and a
// base URL, get a live-updating panel. Same data the public /infra
// page renders, lower-chrome render. No React dependency required;
// a thin React wrapper is also exported for partners using React.

export { renderFreshnessWidget } from "./freshness.js";
export { renderRpcLatencyWidget } from "./rpc-latency.js";
export { renderProofGenWidget } from "./proof-gen.js";
export { iframeUrl } from "./iframe.js";

export type WidgetTheme = "dark" | "light";

export interface WidgetConfig {
  baseUrl: string;
  refreshIntervalMs?: number;
  theme?: WidgetTheme;
}

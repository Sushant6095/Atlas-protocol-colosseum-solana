// Web-component delivery (Phase 24 §3.2).
//
// One custom element <atlas-widget kind="…" base-url="…" vault-id="…"
// theme="dark|light" refresh-ms="…"> that any HTML page can drop in.
// The element internally calls the corresponding `render*Widget`
// function. Attribute changes destroy + re-render to keep behaviour
// predictable.
//
// Registration is opt-in: import "@atlas/widgets/web-component" on a
// page where you want the element available. The export `defineAtlasWidget`
// is also exposed for callers that prefer explicit registration.

import { renderFreshnessWidget } from "./freshness.js";
import { renderRpcLatencyWidget } from "./rpc-latency.js";
import { renderProofGenWidget } from "./proof-gen.js";
import { renderBundleLandedWidget } from "./bundle-landed.js";
import { renderTpsWidget } from "./tps.js";
import { renderLastRebalanceWidget } from "./last-rebalance.js";
import { renderProofOfReserveWidget } from "./proof-of-reserve.js";

export type AtlasWidgetKind =
  | "slot-freshness"
  | "rpc-latency"
  | "proof-gen-latency"
  | "bundle-landed-rate"
  | "tps"
  | "last-rebalance"
  | "proof-of-reserve";

interface Handle { refresh: () => Promise<void>; destroy(): void; }

class AtlasWidgetElement extends HTMLElement {
  private handle: Handle | null = null;

  static get observedAttributes(): string[] {
    return ["kind", "base-url", "vault-id", "theme", "refresh-ms"];
  }

  connectedCallback(): void {
    this.mount();
  }

  disconnectedCallback(): void {
    this.handle?.destroy();
    this.handle = null;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.mount();
  }

  private mount(): void {
    this.handle?.destroy();
    this.handle = null;

    const kind = (this.getAttribute("kind") ?? "") as AtlasWidgetKind;
    const baseUrl = this.getAttribute("base-url") ?? "";
    if (!kind || !baseUrl) {
      this.textContent = "atlas-widget: missing kind / base-url";
      return;
    }
    const vaultId = this.getAttribute("vault-id") ?? "";
    const theme = (this.getAttribute("theme") ?? "dark") as "dark" | "light";
    const refresh = Number(this.getAttribute("refresh-ms") ?? "5000");
    const cfg = { baseUrl, theme, refreshIntervalMs: refresh } as const;

    const host = this as unknown as HTMLElement;

    switch (kind) {
      case "slot-freshness":
        if (!vaultId) return missing(host, "vault-id");
        this.handle = renderFreshnessWidget(host, { ...cfg, vaultId });
        break;
      case "rpc-latency":
        this.handle = renderRpcLatencyWidget(host, cfg);
        break;
      case "proof-gen-latency":
        this.handle = renderProofGenWidget(host, cfg);
        break;
      case "bundle-landed-rate":
        this.handle = renderBundleLandedWidget(host, cfg);
        break;
      case "tps":
        this.handle = renderTpsWidget(host, cfg);
        break;
      case "last-rebalance":
        if (!vaultId) return missing(host, "vault-id");
        this.handle = renderLastRebalanceWidget(host, { ...cfg, vaultId });
        break;
      case "proof-of-reserve":
        if (!vaultId) return missing(host, "vault-id");
        this.handle = renderProofOfReserveWidget(host, { ...cfg, vaultId });
        break;
      default:
        host.textContent = `atlas-widget: unknown kind "${kind as string}"`;
    }
  }
}

function missing(host: HTMLElement, attr: string): void {
  host.textContent = `atlas-widget: missing ${attr}`;
}

export function defineAtlasWidget(tagName = "atlas-widget"): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tagName)) return;
  customElements.define(tagName, AtlasWidgetElement);
}

if (typeof customElements !== "undefined" && !customElements.get("atlas-widget")) {
  defineAtlasWidget();
}

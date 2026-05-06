// Iframe URL helpers — partners that prefer not to embed JS can drop
// an <iframe> pointing at the public Atlas observatory pages. Same
// data, lower-chrome render. The base URL must point at an Atlas
// deployment that serves `/sdk/playground/*.html`.

export type IframePanel =
  | "freshness"
  | "infra"
  | "rpc-latency"
  | "proof-gen";

export interface IframeUrlConfig {
  baseUrl: string;
  panel: IframePanel;
  vaultId?: string;
  /** Embed marker — Atlas backends may render a leaner layout when
   *  this query param is present. */
  embed?: boolean;
}

export function iframeUrl(config: IframeUrlConfig): string {
  const base = config.baseUrl.replace(/\/$/, "");
  const params = new URLSearchParams();
  if (config.embed ?? true) params.set("embed", "1");
  if (config.vaultId) params.set("vault", config.vaultId);
  const file = panelFile(config.panel);
  const qs = params.toString();
  return `${base}/sdk/playground/${file}${qs ? `?${qs}` : ""}`;
}

function panelFile(panel: IframePanel): string {
  switch (panel) {
    case "freshness":
      return "freshness.html";
    case "infra":
    case "rpc-latency":
    case "proof-gen":
      return "infra.html";
  }
}

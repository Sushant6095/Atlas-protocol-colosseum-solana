// WidgetPreview — used on /docs/widgets to render the live widget
// against the demo deployment.
//
// Implementation note: we render via an iframe pointing at the
// public demo's playground pages so the docs site doesn't pull the
// `@atlas/widgets` workspace package into its build graph. Partners
// embedding from their own sites use the snippets shown beneath
// each card.

"use client";

interface IframePanel { file: string; height: number }

const PANEL: Record<string, IframePanel> = {
  "slot-freshness":     { file: "freshness.html", height: 220 },
  "rpc-latency":        { file: "infra.html?panel=rpc-latency", height: 200 },
  "proof-gen-latency":  { file: "infra.html?panel=proof-gen", height: 200 },
  "bundle-landed-rate": { file: "infra.html?panel=bundle-landed", height: 220 },
  "tps":                { file: "infra.html?panel=tps", height: 200 },
  "last-rebalance":     { file: "freshness.html?panel=last-rebalance", height: 240 },
  "proof-of-reserve":   { file: "freshness.html?panel=proof-of-reserve", height: 220 },
};

export interface WidgetPreviewProps {
  kind: string;
  baseUrl: string;
  vaultId?: string;
}

export function WidgetPreview({ kind, baseUrl, vaultId }: WidgetPreviewProps): JSX.Element {
  const panel = PANEL[kind];
  if (!panel) {
    return (
      <div className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
        unknown widget: {kind}
      </div>
    );
  }
  const sep = panel.file.includes("?") ? "&" : "?";
  const vault = vaultId ? `${sep}vault=${vaultId}` : "";
  const src = `${baseUrl.replace(/\/$/, "")}/sdk/playground/${panel.file}${vault}${(vault || sep) ? "&embed=1" : "?embed=1"}`;
  return (
    <iframe
      src={src}
      loading="lazy"
      title={`Atlas widget: ${kind}`}
      style={{
        width: "100%",
        height: panel.height,
        border: "1px solid var(--color-line)",
        borderRadius: 6,
        background: "var(--color-surface-sunken)",
      }}
    />
  );
}

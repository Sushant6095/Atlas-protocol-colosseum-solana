// Bundle Landed Rate widget — shows landed-bundle / total bundles
// over the last 5m, against the 70 % "healthy" threshold.

import type { WidgetConfig } from "./index.js";

interface InfraSnapshot {
  bundles_landed_5m?: number;
  bundles_attempted_5m?: number;
}

export interface BundleLandedWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

const STYLES = `
  .atlas-bl { font: 12px/1.4 -apple-system, system-ui, sans-serif; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--atlas-border, #1d2230); background: var(--atlas-bg, #0e121a); color: var(--atlas-fg, #e7eaf0); }
  .atlas-bl.light { --atlas-border: #d6dae3; --atlas-bg: #ffffff; --atlas-fg: #15181f; }
  .atlas-bl .label { font-size: 10px; color: #8893a8; text-transform: uppercase; letter-spacing: 0.06em; }
  .atlas-bl .stat { font: 600 22px/1 ui-monospace, Menlo, monospace; }
  .atlas-bl .sub { font-size: 11px; color: #8893a8; margin-top: 4px; }
  .atlas-bl .ok { color: #5be1a0; } .atlas-bl .warn { color: #f1d878; } .atlas-bl .bad { color: #ff8b8b; }
  .atlas-bl .bar { height: 6px; background: rgba(136,147,168,0.15); border-radius: 3px; overflow: hidden; margin-top: 6px; }
  .atlas-bl .bar > i { display:block; height:100%; transition: width 0.4s ease; background: #5be1a0; }
  .atlas-bl a { color: #6aa6ff; text-decoration: none; font-size: 10px; }
`;

let stylesInjected = false;
function ensureStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function renderBundleLandedWidget(
  host: HTMLElement,
  config: WidgetConfig,
): BundleLandedWidgetHandle {
  ensureStyles();
  const base = config.baseUrl.replace(/\/$/, "");
  host.classList.add("atlas-bl");
  if (config.theme === "light") host.classList.add("light");

  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    try {
      const r = await fetch(`${base}/api/v1/infra`);
      if (!r.ok) throw new Error(String(r.status));
      const s = (await r.json()) as InfraSnapshot;
      const landed = s.bundles_landed_5m ?? 0;
      const total = Math.max(landed, s.bundles_attempted_5m ?? 0);
      const ratio = total > 0 ? landed / total : 0;
      const pct = Math.round(ratio * 100);
      const tone = ratio >= 0.7 ? "ok" : ratio >= 0.5 ? "warn" : "bad";
      host.innerHTML = `
        <div class="label">bundle landed · last 5m</div>
        <div class="stat ${tone}">${pct}%</div>
        <div class="bar"><i style="width:${pct}%;background:${tone === "ok" ? "#5be1a0" : tone === "warn" ? "#f1d878" : "#ff8b8b"}"></i></div>
        <div class="sub">${landed.toLocaleString()} of ${total.toLocaleString()} bundles</div>
        <div style="margin-top:6px"><a href="${base}/sdk/playground/infra.html" target="_blank">view /infra</a></div>
      `;
    } catch {
      host.innerHTML = `<div class="label">bundle landed</div><div class="stat bad">offline</div>`;
    }
  }

  refresh();
  if (config.refreshIntervalMs && config.refreshIntervalMs > 0) {
    timer = setInterval(refresh, config.refreshIntervalMs);
  }

  return {
    refresh,
    destroy() {
      if (timer) clearInterval(timer);
      host.innerHTML = "";
      host.classList.remove("atlas-bl", "light");
    },
  };
}

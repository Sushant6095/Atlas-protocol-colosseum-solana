// TPS widget — current Solana cluster TPS (true / vote-removed).

import type { WidgetConfig } from "./index.js";

interface InfraSnapshot {
  tps?: { true_tps?: number; vote_removed_tps?: number; sample_age_ms?: number };
}

export interface TpsWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

const STYLES = `
  .atlas-tps { font: 12px/1.4 -apple-system, system-ui, sans-serif; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--atlas-border, #1d2230); background: var(--atlas-bg, #0e121a); color: var(--atlas-fg, #e7eaf0); }
  .atlas-tps.light { --atlas-border: #d6dae3; --atlas-bg: #ffffff; --atlas-fg: #15181f; }
  .atlas-tps .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .atlas-tps .label { font-size: 10px; color: #8893a8; text-transform: uppercase; letter-spacing: 0.06em; }
  .atlas-tps .stat { font: 600 20px/1 ui-monospace, Menlo, monospace; color: #6aa6ff; }
  .atlas-tps .sub { font-size: 10px; color: #8893a8; margin-top: 6px; }
  .atlas-tps a { color: #6aa6ff; text-decoration: none; font-size: 10px; }
`;

let stylesInjected = false;
function ensureStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function renderTpsWidget(
  host: HTMLElement,
  config: WidgetConfig,
): TpsWidgetHandle {
  ensureStyles();
  const base = config.baseUrl.replace(/\/$/, "");
  host.classList.add("atlas-tps");
  if (config.theme === "light") host.classList.add("light");

  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    try {
      const r = await fetch(`${base}/api/v1/infra`);
      if (!r.ok) throw new Error(String(r.status));
      const s = (await r.json()) as InfraSnapshot;
      const t = s.tps ?? {};
      host.innerHTML = `
        <div class="row">
          <div>
            <div class="label">true tps</div>
            <div class="stat">${fmt(t.true_tps)}</div>
          </div>
          <div>
            <div class="label">vote-removed</div>
            <div class="stat">${fmt(t.vote_removed_tps)}</div>
          </div>
        </div>
        <div class="sub">sample age ${fmtAge(t.sample_age_ms)}</div>
        <div style="margin-top:6px"><a href="${base}/sdk/playground/infra.html" target="_blank">view /infra</a></div>
      `;
    } catch {
      host.innerHTML = `<div class="label">tps</div><div class="stat" style="color:#ff8b8b">offline</div>`;
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
      host.classList.remove("atlas-tps", "light");
    },
  };
}

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : Math.round(n).toLocaleString();
}
function fmtAge(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

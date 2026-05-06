// Proof-Gen Latency widget — shows current proof generation p50/p99
// against the 75s p99 SLO.

import type { WidgetConfig } from "./index.js";

interface InfraSnapshot {
  proof_gen_p50_ms: number;
  proof_gen_p99_ms: number;
}

export interface ProofGenWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

const STYLES = `
  .atlas-pg { font: 12px/1.4 -apple-system, system-ui, sans-serif; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--atlas-border, #1d2230); background: var(--atlas-bg, #0e121a); color: var(--atlas-fg, #e7eaf0); }
  .atlas-pg.light { --atlas-border: #d6dae3; --atlas-bg: #ffffff; --atlas-fg: #15181f; }
  .atlas-pg .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .atlas-pg .label { font-size: 10px; color: #8893a8; text-transform: uppercase; letter-spacing: 0.06em; }
  .atlas-pg .stat { font: 600 18px/1 ui-monospace, Menlo, monospace; }
  .atlas-pg .ok { color: #5be1a0; }
  .atlas-pg .warn { color: #f1d878; }
  .atlas-pg .bad { color: #ff8b8b; }
  .atlas-pg a { color: #6aa6ff; text-decoration: none; font-size: 10px; }
`;

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function renderProofGenWidget(
  host: HTMLElement,
  config: WidgetConfig,
): ProofGenWidgetHandle {
  ensureStyles();
  const base = config.baseUrl.replace(/\/$/, "");
  host.classList.add("atlas-pg");
  if (config.theme === "light") host.classList.add("light");

  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    try {
      const r = await fetch(`${base}/api/v1/infra`);
      if (!r.ok) throw new Error(String(r.status));
      const s = (await r.json()) as InfraSnapshot;
      host.innerHTML = `
        <div class="row">
          <div>
            <div class="label">proof gen p50</div>
            <div class="stat">${fmt(s.proof_gen_p50_ms)}</div>
          </div>
          <div>
            <div class="label">p99 · SLO 75s</div>
            <div class="stat ${slo(s.proof_gen_p99_ms, 75_000)}">${fmt(s.proof_gen_p99_ms)}</div>
          </div>
        </div>
        <div style="margin-top:6px"><a href="${base}/sdk/playground/infra.html" target="_blank">view /infra</a></div>
      `;
    } catch (e) {
      host.innerHTML = `<div class="label">proof gen</div><div class="stat bad">offline</div>`;
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
      host.classList.remove("atlas-pg", "light");
    },
  };
}

function fmt(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}
function slo(observed: number | null | undefined, budget: number) {
  if (observed == null) return "";
  if (observed <= budget * 0.7) return "ok";
  if (observed <= budget) return "warn";
  return "bad";
}

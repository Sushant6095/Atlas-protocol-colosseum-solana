// RPC Latency widget — shows current Tier-A vs Tier-B p99.

import type { WidgetConfig } from "./index.js";

interface RpcLatencyRow {
  source: string;
  role: string;
  region: string;
  p50_ms: number;
  p99_ms: number;
}

interface InfraSnapshot {
  rpc_latency: RpcLatencyRow[];
}

export interface RpcLatencyWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

const STYLES = `
  .atlas-rl { font: 12px/1.4 -apple-system, system-ui, sans-serif; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--atlas-border, #1d2230); background: var(--atlas-bg, #0e121a); color: var(--atlas-fg, #e7eaf0); }
  .atlas-rl.light { --atlas-border: #d6dae3; --atlas-bg: #ffffff; --atlas-fg: #15181f; }
  .atlas-rl .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .atlas-rl .label { font-size: 10px; color: #8893a8; text-transform: uppercase; letter-spacing: 0.06em; }
  .atlas-rl .stat { font: 600 18px/1 ui-monospace, Menlo, monospace; }
  .atlas-rl .ok { color: #5be1a0; }
  .atlas-rl .warn { color: #f1d878; }
  .atlas-rl .bad { color: #ff8b8b; }
  .atlas-rl a { color: #6aa6ff; text-decoration: none; font-size: 10px; }
`;

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function renderRpcLatencyWidget(
  host: HTMLElement,
  config: WidgetConfig,
): RpcLatencyWidgetHandle {
  ensureStyles();
  const base = config.baseUrl.replace(/\/$/, "");
  host.classList.add("atlas-rl");
  if (config.theme === "light") host.classList.add("light");

  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    try {
      const r = await fetch(`${base}/api/v1/infra`);
      if (!r.ok) throw new Error(String(r.status));
      const s = (await r.json()) as InfraSnapshot;
      const tierA = (s.rpc_latency ?? []).filter(r => r.role === "tier_a_latency");
      const tierB = (s.rpc_latency ?? []).filter(r => r.role === "tier_b_quorum");
      const aP99 = max(tierA.map(r => r.p99_ms));
      const bP99 = max(tierB.map(r => r.p99_ms));
      host.innerHTML = `
        <div class="row">
          <div>
            <div class="label">tier-A p99 · budget 250ms</div>
            <div class="stat ${slo(aP99, 250)}">${fmt(aP99)}</div>
          </div>
          <div>
            <div class="label">tier-B p99 · budget 800ms</div>
            <div class="stat ${slo(bP99, 800)}">${fmt(bP99)}</div>
          </div>
        </div>
        <div style="margin-top:6px"><a href="${base}/sdk/playground/infra.html" target="_blank">view /infra</a></div>
      `;
    } catch (e) {
      host.innerHTML = `<div class="label">rpc latency</div><div class="stat bad">offline</div>`;
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
      host.classList.remove("atlas-rl", "light");
    },
  };
}

function fmt(n: number | null) { return n == null ? "—" : `${n}ms`; }
function max(arr: number[]) { return arr.length ? Math.max(...arr) : null; }
function slo(observed: number | null, budget: number) {
  if (observed == null) return "";
  if (observed <= budget * 0.7) return "ok";
  if (observed <= budget) return "warn";
  return "bad";
}

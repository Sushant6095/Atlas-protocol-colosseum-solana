// Last Rebalance widget — most recent verified rebalance for a vault.
// Shows slot, age, ratio_diff_summary, proof status. Click → opens
// the proof in /proofs/{public_input_hash} on the host site.

import type { WidgetConfig } from "./index.js";

interface RebalanceView {
  slot: number;
  emitted_at_ms: number;
  vault_id: string;
  ratio_diff_summary: string;
  public_input_hash: string;
  proof_status: "verified" | "pending" | "rejected";
}

interface RebalanceListResponse {
  events: RebalanceView[];
}

export interface LastRebalanceWidgetConfig extends WidgetConfig {
  vaultId: string;
}

export interface LastRebalanceWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

const STYLES = `
  .atlas-lr { font: 12px/1.4 -apple-system, system-ui, sans-serif; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--atlas-border, #1d2230); background: var(--atlas-bg, #0e121a); color: var(--atlas-fg, #e7eaf0); }
  .atlas-lr.light { --atlas-border: #d6dae3; --atlas-bg: #ffffff; --atlas-fg: #15181f; }
  .atlas-lr .label { font-size: 10px; color: #8893a8; text-transform: uppercase; letter-spacing: 0.06em; }
  .atlas-lr .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .atlas-lr .slot { font: 600 16px/1 ui-monospace, Menlo, monospace; }
  .atlas-lr .diff { font: 13px/1.4 ui-monospace, Menlo, monospace; color: #c8d0dd; margin-top: 4px; }
  .atlas-lr .age { font-size: 11px; color: #8893a8; }
  .atlas-lr .pill { display:inline-block; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .atlas-lr .pill.verified { background:#1f3d2e; color:#5be1a0; }
  .atlas-lr .pill.pending  { background:#4d3d1f; color:#f1d878; }
  .atlas-lr .pill.rejected { background:#4d1f1f; color:#ff8b8b; }
  .atlas-lr a { color: #6aa6ff; text-decoration: none; font-size: 11px; }
`;

let stylesInjected = false;
function ensureStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function renderLastRebalanceWidget(
  host: HTMLElement,
  config: LastRebalanceWidgetConfig,
): LastRebalanceWidgetHandle {
  ensureStyles();
  const base = config.baseUrl.replace(/\/$/, "");
  host.classList.add("atlas-lr");
  if (config.theme === "light") host.classList.add("light");

  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    try {
      const r = await fetch(`${base}/api/v1/vault/${config.vaultId}/rebalances?limit=1`);
      if (!r.ok) throw new Error(String(r.status));
      const json = (await r.json()) as RebalanceListResponse;
      const e = json.events?.[0];
      if (!e) {
        host.innerHTML = `<div class="label">last rebalance</div><div class="slot">none</div>`;
        return;
      }
      host.innerHTML = `
        <div class="row">
          <div class="label">last rebalance</div>
          <span class="pill ${e.proof_status}">${e.proof_status}</span>
        </div>
        <div class="row" style="margin-top:6px">
          <span class="slot">slot ${e.slot.toLocaleString()}</span>
          <span class="age">${fmtAge(Date.now() - e.emitted_at_ms)}</span>
        </div>
        <div class="diff">${escapeHtml(e.ratio_diff_summary)}</div>
        <div style="margin-top:6px"><a href="${base}/proofs/${e.public_input_hash}" target="_blank">view proof</a></div>
      `;
    } catch {
      host.innerHTML = `<div class="label">last rebalance</div><div class="slot" style="color:#ff8b8b">offline</div>`;
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
      host.classList.remove("atlas-lr", "light");
    },
  };
}

function fmtAge(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[c]!));
}

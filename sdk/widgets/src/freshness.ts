// Slot Freshness Monitor widget.
//
// Renders a single vault's freshness budget into the host element.
// `vaultId` is the hex32 vault id; `baseUrl` is the Atlas API root.

import type { WidgetConfig } from "./index.js";

export interface FreshnessWidgetConfig extends WidgetConfig {
  vaultId: string;
  /** Hide the verification-window-seconds line. Default false. */
  compact?: boolean;
}

interface FreshnessBudgetView {
  vault_id: string;
  current_slot: number;
  last_proof_slot: number;
  slot_drift: number;
  freshness_remaining_slots: number;
  verification_window_seconds_remaining: number;
  band: "green" | "amber" | "red";
}

export interface FreshnessWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

const STYLES = `
  .atlas-fw { font: 12px/1.4 -apple-system, system-ui, sans-serif; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--atlas-border, #1d2230); background: var(--atlas-bg, #0e121a); color: var(--atlas-fg, #e7eaf0); }
  .atlas-fw.light { --atlas-border: #d6dae3; --atlas-bg: #ffffff; --atlas-fg: #15181f; }
  .atlas-fw .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .atlas-fw .label { font-size: 10px; color: #8893a8; text-transform: uppercase; letter-spacing: 0.06em; }
  .atlas-fw .stat { font: 600 16px/1 ui-monospace, Menlo, monospace; }
  .atlas-fw .gauge { height: 6px; background: rgba(136, 147, 168, 0.15); border-radius: 3px; overflow: hidden; margin: 6px 0 4px; }
  .atlas-fw .gauge .fill { height: 100%; transition: width 0.4s ease; }
  .atlas-fw .gauge .fill.green { background: #5be1a0; }
  .atlas-fw .gauge .fill.amber { background: #f1d878; }
  .atlas-fw .gauge .fill.red { background: #ff8b8b; }
  .atlas-fw .band { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
  .atlas-fw .band.green { background: #1f3d2e; color: #5be1a0; }
  .atlas-fw .band.amber { background: #4d3d1f; color: #f1d878; }
  .atlas-fw .band.red { background: #4d1f1f; color: #ff8b8b; }
  .atlas-fw a { color: #6aa6ff; text-decoration: none; font-size: 10px; }
`;

const MAX_STALE_SLOTS = 150;

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function renderFreshnessWidget(
  host: HTMLElement,
  config: FreshnessWidgetConfig,
): FreshnessWidgetHandle {
  ensureStyles();
  const base = config.baseUrl.replace(/\/$/, "");
  host.classList.add("atlas-fw");
  if (config.theme === "light") host.classList.add("light");

  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    try {
      const r = await fetch(`${base}/api/v1/freshness/${config.vaultId}`);
      if (!r.ok) throw new Error(String(r.status));
      const json = (await r.json()) as { budget: FreshnessBudgetView } | FreshnessBudgetView;
      const b = "budget" in json ? json.budget : (json as FreshnessBudgetView);
      const pct = Math.max(0, Math.min(100, Math.round((b.freshness_remaining_slots / MAX_STALE_SLOTS) * 100)));
      const compact = !!config.compact;
      host.innerHTML = `
        <div class="row">
          <div>
            <div class="label">slot freshness · ${shortId(b.vault_id)}</div>
            <div class="stat">${b.freshness_remaining_slots} / ${MAX_STALE_SLOTS} slots</div>
          </div>
          <span class="band ${b.band}">${b.band}</span>
        </div>
        <div class="gauge"><div class="fill ${b.band}" style="width:${pct}%"></div></div>
        ${compact ? "" : `<div class="row" style="font-size:10px;color:#8893a8;letter-spacing:0.04em;text-transform:uppercase">
          <span>drift ${b.slot_drift}</span>
          <span>${b.verification_window_seconds_remaining}s remaining</span>
        </div>`}
        <div style="margin-top:6px"><a href="${base}/sdk/playground/freshness.html" target="_blank">view all</a></div>
      `;
    } catch (e) {
      host.innerHTML = `<div class="label">slot freshness</div><div class="stat" style="color:#ff8b8b">offline</div>`;
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
      host.classList.remove("atlas-fw", "light");
    },
  };
}

function shortId(s: string) {
  if (!s) return "";
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

// Proof-of-Reserve widget — most recent attestation summary for a
// vault. Rolls up reported balance vs. attested balance + delta band
// + last attestation age. Click → /vault/{id}/reserve.

import type { WidgetConfig } from "./index.js";

interface PorView {
  vault_id: string;
  attested_balance_atomic: string;
  reported_balance_atomic: string;
  decimals: number;
  delta_bps: number;
  band: "green" | "amber" | "red";
  attested_at_ms: number;
  attestation_hash: string;
}

export interface ProofOfReserveWidgetConfig extends WidgetConfig {
  vaultId: string;
}

export interface ProofOfReserveWidgetHandle {
  refresh(): Promise<void>;
  destroy(): void;
}

const STYLES = `
  .atlas-por { font: 12px/1.4 -apple-system, system-ui, sans-serif; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--atlas-border, #1d2230); background: var(--atlas-bg, #0e121a); color: var(--atlas-fg, #e7eaf0); }
  .atlas-por.light { --atlas-border: #d6dae3; --atlas-bg: #ffffff; --atlas-fg: #15181f; }
  .atlas-por .label { font-size: 10px; color: #8893a8; text-transform: uppercase; letter-spacing: 0.06em; }
  .atlas-por .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .atlas-por .stat { font: 600 18px/1 ui-monospace, Menlo, monospace; }
  .atlas-por .delta { font-size: 11px; }
  .atlas-por .band { display:inline-block; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
  .atlas-por .band.green { background:#1f3d2e; color:#5be1a0; }
  .atlas-por .band.amber { background:#4d3d1f; color:#f1d878; }
  .atlas-por .band.red   { background:#4d1f1f; color:#ff8b8b; }
  .atlas-por .age { font-size: 11px; color: #8893a8; margin-top: 4px; }
  .atlas-por a { color: #6aa6ff; text-decoration: none; font-size: 11px; }
`;

let stylesInjected = false;
function ensureStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

export function renderProofOfReserveWidget(
  host: HTMLElement,
  config: ProofOfReserveWidgetConfig,
): ProofOfReserveWidgetHandle {
  ensureStyles();
  const base = config.baseUrl.replace(/\/$/, "");
  host.classList.add("atlas-por");
  if (config.theme === "light") host.classList.add("light");

  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    try {
      const r = await fetch(`${base}/api/v1/vault/${config.vaultId}/proof-of-reserve`);
      if (!r.ok) throw new Error(String(r.status));
      const v = (await r.json()) as PorView;
      const attested = atomicToHuman(v.attested_balance_atomic, v.decimals);
      const sign = v.delta_bps > 0 ? "+" : "";
      host.innerHTML = `
        <div class="row">
          <div class="label">proof of reserve · ${shortId(v.vault_id)}</div>
          <span class="band ${v.band}">${v.band}</span>
        </div>
        <div class="row" style="margin-top:6px">
          <span class="stat">${attested}</span>
          <span class="delta" style="color:${v.band === "green" ? "#5be1a0" : v.band === "amber" ? "#f1d878" : "#ff8b8b"}">${sign}${(v.delta_bps / 100).toFixed(2)}%</span>
        </div>
        <div class="age">${fmtAge(Date.now() - v.attested_at_ms)}</div>
        <div style="margin-top:6px"><a href="${base}/vault/${v.vault_id}/reserve" target="_blank">view attestation</a></div>
      `;
    } catch {
      host.innerHTML = `<div class="label">proof of reserve</div><div class="stat" style="color:#ff8b8b">offline</div>`;
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
      host.classList.remove("atlas-por", "light");
    },
  };
}

function atomicToHuman(atomic: string, decimals: number): string {
  if (!atomic) return "—";
  // Conservative big-int math without bringing in a dep.
  const neg = atomic.startsWith("-");
  const digits = neg ? atomic.slice(1) : atomic;
  if (decimals <= 0) return digits;
  const pad = digits.padStart(decimals + 1, "0");
  const int = pad.slice(0, -decimals);
  const frac = pad.slice(-decimals).replace(/0+$/, "");
  const grouped = Number(int).toLocaleString();
  return `${neg ? "-" : ""}${grouped}${frac ? "." + frac.slice(0, 4) : ""}`;
}

function fmtAge(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

function shortId(s: string): string {
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

// Popup — toolbar entry point. Compact dashboard: vault freshness,
// last rebalance, "open side panel" CTA, settings link.

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings, type ExtensionSettings } from "../../lib/storage";

interface FreshnessSummary {
  current_slot: number;
  freshness_remaining_slots: number;
  band: "green" | "amber" | "red";
}

function Popup(): JSX.Element {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [freshness, setFreshness] = useState<FreshnessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (!settings || !settings.defaultVaultId) return;
    void fetch(`${settings.baseUrl}/api/v1/freshness/${settings.defaultVaultId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { budget?: FreshnessSummary } | FreshnessSummary) => {
        const view = "budget" in j ? j.budget! : j as FreshnessSummary;
        setFreshness(view);
      })
      .catch((e: Error) => setError(e.message));
  }, [settings]);

  function openSidePanel(): void {
    if (typeof chrome === "undefined") return;
    if (chrome.sidePanel?.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.windowId != null) {
          chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined);
        }
      });
    }
  }

  function openOptions(): void {
    if (typeof chrome === "undefined") return;
    chrome.runtime.openOptionsPage?.();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <strong style={{ font: "600 14px ui-monospace, Menlo, monospace", letterSpacing: "0.04em" }}>
          ATLAS
        </strong>
        <span style={{ fontSize: 10, color: "#8893a8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          treasury OS
        </span>
      </header>

      {!settings?.defaultVaultId ? (
        <div style={{ color: "#8893a8" }}>
          Set a default vault in settings to see live freshness.
        </div>
      ) : freshness ? (
        <FreshnessTile fr={freshness} />
      ) : error ? (
        <div style={{ color: "#ff8b8b" }}>API error: {error}</div>
      ) : (
        <div style={{ color: "#8893a8" }}>loading…</div>
      )}

      <button onClick={openSidePanel} style={btn("primary")}>
        Open inspector
      </button>
      <button onClick={openOptions} style={btn("ghost")}>
        Settings · Allowlist
      </button>
    </div>
  );
}

function FreshnessTile({ fr }: { fr: FreshnessSummary }): JSX.Element {
  const colour = fr.band === "green" ? "#5be1a0" : fr.band === "amber" ? "#f1d878" : "#ff8b8b";
  return (
    <div style={{ border: "1px solid #1d2230", borderRadius: 6, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "#8893a8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        slot freshness
      </div>
      <div style={{ font: "600 18px/1 ui-monospace, Menlo, monospace", color: colour, marginTop: 4 }}>
        {fr.freshness_remaining_slots} / 150
      </div>
      <div style={{ fontSize: 11, color: "#8893a8", marginTop: 4 }}>
        slot {fr.current_slot.toLocaleString()}
      </div>
    </div>
  );
}

function btn(kind: "primary" | "ghost"): React.CSSProperties {
  return {
    border: "1px solid " + (kind === "primary" ? "#6aa6ff" : "#1d2230"),
    background: kind === "primary" ? "#143052" : "transparent",
    color: kind === "primary" ? "#e7eaf0" : "#c8d0dd",
    borderRadius: 4,
    padding: "8px 10px",
    font: "12px -apple-system, system-ui, sans-serif",
    cursor: "pointer",
  };
}

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Popup />
    </StrictMode>,
  );
}

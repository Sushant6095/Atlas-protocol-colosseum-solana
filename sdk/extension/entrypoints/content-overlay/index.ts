// Content script — Phase 24 §4.4.
//
// Watches the host page's wallet adapter for sign requests. When
// the origin is on the user's allowlist + pre-sign overlay enabled,
// freezes the signing flow and surfaces an Atlas explanation overlay
// before the wallet prompt opens. The user can approve, reject, or
// "open in side panel" for the full proof.

import { defineContentScript } from "wxt/sandbox";
import { isAllowed } from "../../lib/storage";
import type { AtlasMessage, ExplanationView } from "../../lib/messaging";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    if (typeof window === "undefined") return;

    const origin = window.location.origin;

    // Bridge — listen for wallet requests via the standard wallet-
    // adapter events the page emits before signing.
    window.addEventListener("atlas:wallet-intercept", (evt: Event) => {
      const e = evt as CustomEvent<{ method: string; payloadB64: string }>;
      void handleIntercept(origin, e.detail);
    });

    // Handle decisions sent from the side panel / popup.
    chrome.runtime.onMessage.addListener((raw) => {
      const msg = raw as AtlasMessage;
      if (msg.kind === "wallet.decision") {
        window.dispatchEvent(new CustomEvent("atlas:wallet-decision", { detail: msg }));
      }
    });
  },
});

async function handleIntercept(
  origin: string,
  detail: { method: string; payloadB64: string },
): Promise<void> {
  if (!(await isAllowed(origin))) return; // silent on non-allowlisted origins

  // Hand the payload to the side panel for explanation. The SP fetches
  // the explanation from the user's local QVAC + the Atlas /api/v1/explain
  // endpoint (Phase 19).
  const msg: AtlasMessage = {
    kind: "wallet.intercept",
    origin,
    method: detail.method,
    payloadB64: detail.payloadB64,
  };
  chrome.runtime.sendMessage(msg).catch(() => undefined);

  // Inject minimal "Atlas is reviewing…" overlay while the side
  // panel resolves. The full pre-sign explainer lives in the side
  // panel; this overlay only blocks the page until user decides.
  showHoldingOverlay();
}

function showHoldingOverlay(): void {
  if (document.getElementById("atlas-holding-overlay")) return;
  const root = document.createElement("div");
  root.id = "atlas-holding-overlay";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-live", "assertive");
  root.style.cssText = [
    "position:fixed", "inset:0", "z-index:2147483646",
    "background:rgba(8,10,14,0.6)", "backdrop-filter:blur(2px)",
    "display:flex", "align-items:center", "justify-content:center",
    "color:#e7eaf0", "font:14px -apple-system, system-ui, sans-serif",
  ].join(";");
  root.innerHTML = `
    <div style="background:#0e121a; border:1px solid #1d2230; border-radius:8px; padding:18px 22px; max-width:360px;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#8893a8;">Atlas</div>
      <div style="margin-top:6px;">Reviewing pre-sign payload — open the Atlas side panel to approve.</div>
    </div>
  `;
  document.documentElement.appendChild(root);

  // Auto-clear if a decision arrives.
  const remove = (): void => root.remove();
  window.addEventListener("atlas:wallet-decision", remove, { once: true });
}

// Dummy export — keeps TS happy if any tooling imports the type.
export type { ExplanationView };

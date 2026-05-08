// Service worker — Phase 24 §4.3.
//
// Routes messages between the content script (on each tab) and the
// side panel / popup. The worker also enforces the "open side panel
// on action click" UX so Atlas behaves like a sidebar inspector
// rather than a popup-only surface.

import { defineBackground } from "wxt/sandbox";
import type { AtlasMessage } from "../lib/messaging";

export default defineBackground(() => {
  if (typeof chrome === "undefined") return;

  // Open side panel when the toolbar action is clicked.
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => undefined);
  }

  chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const msg = raw as AtlasMessage;
    if (!msg || typeof msg.kind !== "string") return false;

    switch (msg.kind) {
      case "wallet.intercept": {
        // Forward intercept events to all open Atlas surfaces (side
        // panel, popup) so the user sees the explanation.
        chrome.runtime.sendMessage(msg).catch(() => undefined);
        sendResponse({ ok: true });
        return true;
      }
      case "wallet.decision": {
        // Bounce the decision back to the originating tab.
        if (sender.tab?.id != null) {
          chrome.tabs.sendMessage(sender.tab.id, msg).catch(() => undefined);
        }
        sendResponse({ ok: true });
        return true;
      }
      case "allowlist.changed": {
        chrome.runtime.sendMessage(msg).catch(() => undefined);
        sendResponse({ ok: true });
        return true;
      }
      default:
        return false;
    }
  });
});

// WXT config — Phase 24 §4.
//
// Targets Chrome (MV3) + Firefox (MV3 with `manifest.version: 3`
// as supported by 113+). The extension is read-only by default;
// pre-sign overlay activates only on hosts in the user's allowlist.

import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  srcDir: ".",
  outDir: ".output",
  manifest: {
    name: "Atlas — verifiable treasury OS",
    short_name: "Atlas",
    description: "Inspect proofs, freshness, and pre-sign payloads on any Solana site.",
    permissions: ["storage", "activeTab", "sidePanel"],
    host_permissions: [
      "https://*.solana.com/*",
      "https://*.atlas.example/*",
      "<all_urls>",
    ],
    side_panel: { default_path: "sidepanel.html" },
    action: { default_popup: "popup.html", default_title: "Atlas" },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png",
    },
    web_accessible_resources: [
      {
        resources: ["content-overlay/style.css"],
        matches: ["<all_urls>"],
      },
    ],
  },
});

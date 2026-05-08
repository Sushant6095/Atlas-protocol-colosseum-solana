// Cross-context message types shared by content / overlay / popup /
// side panel / background. All messages flow through chrome.runtime
// or chrome.tabs.sendMessage; the discriminator is `kind`.

export type AtlasMessage =
  | { kind: "wallet.intercept"; origin: string; method: string; payloadB64: string }
  | { kind: "wallet.decision";  decisionId: string; approve: boolean }
  | { kind: "overlay.show";     decisionId: string; explanation: ExplanationView }
  | { kind: "overlay.hide" }
  | { kind: "allowlist.changed"; origin: string; preSign: boolean };

export interface ExplanationView {
  /** One-sentence human summary. */
  headline: string;
  /** Programs this tx will touch (display names). */
  programs: string[];
  /** SOL or atomic-balance deltas keyed by mint. */
  balanceDeltas: { mint: string; delta: string }[];
  /** Blocking risks ("transfer authority", "program upgrade", …). */
  risks: string[];
  /** Atlas explanation hash (links to /proofs/{hash}). */
  explanationHash: string;
}

export function sendToTab(
  tabId: number,
  msg: AtlasMessage,
): Promise<unknown> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined") return resolve(undefined);
    chrome.tabs.sendMessage(tabId, msg, (r) => resolve(r));
  });
}

export function sendToRuntime(msg: AtlasMessage): Promise<unknown> {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined") return resolve(undefined);
    chrome.runtime.sendMessage(msg, (r) => resolve(r));
  });
}

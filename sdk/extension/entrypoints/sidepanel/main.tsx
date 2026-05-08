// Side panel — full inspector. Hosts the pre-sign overlay, allowlist
// editor, and live infra readout. Uses the same explanation hash
// scheme as web (Phase 19) so the user can cross-reference proofs.

import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PreSignOverlay } from "../../components/PreSignOverlay";
import { AllowlistEditor } from "../../components/AllowlistEditor";
import type { AtlasMessage, ExplanationView } from "../../lib/messaging";

type Tab = "inspect" | "allowlist";

function SidePanel(): JSX.Element {
  const [tab, setTab] = useState<Tab>("inspect");
  const [pending, setPending] = useState<{ origin: string; explanation: ExplanationView } | null>(null);

  const onMessage = useCallback((raw: unknown) => {
    const msg = raw as AtlasMessage;
    if (msg.kind === "wallet.intercept") {
      // For demo we synthesize an explanation; the real surface
      // would call POST /api/v1/explain or the local QVAC explainer.
      setPending({
        origin: msg.origin,
        explanation: {
          headline: "This transaction transfers tokens from your treasury vault.",
          programs: ["AtlasVault", "Token-2022"],
          balanceDeltas: [{ mint: "USDC", delta: "-12,500" }, { mint: "SOL", delta: "-0.0023 (fee)" }],
          risks: [],
          explanationHash: "a1b2c3d4e5f60718",
        },
      });
    }
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined") return;
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [onMessage]);

  function decide(approve: boolean): void {
    if (!pending || typeof chrome === "undefined") return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId == null) return;
      const msg: AtlasMessage = { kind: "wallet.decision", decisionId: pending.explanation.explanationHash, approve };
      chrome.tabs.sendMessage(tabId, msg).catch(() => undefined);
      setPending(null);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ font: "600 14px ui-monospace, Menlo, monospace", letterSpacing: "0.04em" }}>ATLAS · Inspector</strong>
        <nav style={{ display: "flex", gap: 4 }}>
          <TabBtn active={tab === "inspect"}   onClick={() => setTab("inspect")}>Inspect</TabBtn>
          <TabBtn active={tab === "allowlist"} onClick={() => setTab("allowlist")}>Allowlist</TabBtn>
        </nav>
      </header>

      {tab === "inspect" ? (
        pending ? (
          <PreSignOverlay
            origin={pending.origin}
            explanation={pending.explanation}
            onApprove={() => decide(true)}
            onReject={() => decide(false)}
          />
        ) : (
          <div style={{ color: "#8893a8" }}>
            No pending signing requests. Open a Solana site on your allowlist to inspect a transaction before signing.
          </div>
        )
      ) : (
        <AllowlistEditor />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}): JSX.Element {
  return (
    <button onClick={onClick} style={{
      border: "1px solid " + (active ? "#6aa6ff" : "#1d2230"),
      background: active ? "#143052" : "transparent",
      color: active ? "#e7eaf0" : "#c8d0dd",
      borderRadius: 4, padding: "5px 10px", font: "11px -apple-system, system-ui, sans-serif", cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SidePanel />
    </StrictMode>,
  );
}

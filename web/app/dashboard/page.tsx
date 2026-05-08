// /dashboard — Lulo-quality operator landing.
//
// Mirror of apps/app/app/page.tsx so the canonical dev server on
// :3000 ships the dashboard for testing while the apps/app
// migration lands. Demo view by default; click "Connect" to
// preview the connected state.

"use client";

import { useState } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function Page(): JSX.Element {
  const [connected, setConnected] = useState(false);

  return (
    <Dashboard
      connected={connected}
      walletPubkey={connected ? "GjK21qC2yT6kxRn9wA8sV2P7N8YaH5xQfN1bR3CcEdFg" : undefined}
      onConnect={() => setConnected(true)}
    />
  );
}

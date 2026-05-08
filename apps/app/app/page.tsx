// app.atlasfi.in — operator dashboard.
//
// Demo View renders by default. Once a wallet connects (PR 7 wires
// the Solana wallet-adapter into apps/app), the banner hides and
// the summary block populates with real balances.

"use client";

import { useState } from "react";
import { Dashboard } from "@/components/Dashboard";

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

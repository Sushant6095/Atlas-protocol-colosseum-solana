// /docs/vault/deposit-withdraw — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Deposit and withdraw"
      description="How money flows in and out of the vault."
      intro="Walks the full deposit and withdraw flow: wallet connect, approval, settlement, the LP token you receive, and how withdrawal queueing works under stress. Includes the SIWS auth flow and a simulate-then-sign deposit instruction."
    />
  );
}

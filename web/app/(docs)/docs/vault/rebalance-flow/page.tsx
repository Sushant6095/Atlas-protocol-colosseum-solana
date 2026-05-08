// /docs/vault/rebalance-flow — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Rebalance pipeline"
      description="Sixteen stages from intent to settled receipt."
      intro="Every Atlas rebalance moves through a 16-stage pipeline. Intent → simulation → policy check → proof generation → bundle assembly → on-chain verification → settlement → receipt. This page explains each stage, what can stall a rebalance there, and how to read the live timeline on /rebalance/live."
    />
  );
}

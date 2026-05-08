// /docs/protocol/verifier-cpi — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Verifier as a public good"
      description="An open verify-inference CPI any Solana program can call."
      intro="The verify-inference CPI takes a Groth16 receipt and a public input and returns a boolean. It is open, free at the gas level, and stable across versions. We treat it as a public good: third-party teams shipping their own AI products on Solana can use it without integrating with Atlas otherwise."
    />
  );
}

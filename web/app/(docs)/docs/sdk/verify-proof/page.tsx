// /docs/sdk/verify-proof — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Verify a proof client-side"
      description="Run the Groth16 verifier in your browser."
      intro="Walk-through of the standalone WASM verify path: load a receipt, parse the public input, run sp1-solana through WebAssembly, get a boolean. Use this when you want to verify Atlas without any Atlas-controlled code in the loop."
    />
  );
}

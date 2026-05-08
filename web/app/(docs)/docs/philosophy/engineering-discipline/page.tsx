// /docs/philosophy/engineering-discipline — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Engineering discipline"
      description="No unwrap, no clock-now, no shortcuts."
      intro="A short list of rules the codebase follows: no unwrap in production paths, no chrono::now in deterministic code, no mocks in integration tests, no untyped HTTP responses, no merging without two reviews when the path is on the proof critical line. These are the boring rules that let the interesting parts work."
    />
  );
}

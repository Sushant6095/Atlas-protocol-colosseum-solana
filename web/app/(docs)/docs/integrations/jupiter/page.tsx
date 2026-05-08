// /docs/integrations/jupiter — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Jupiter"
      description="Trigger, Recurring, and Lend."
      intro="Jupiter exposes Trigger orders, Recurring orders, and a Lend market. Atlas uses Trigger for execution and Lend for short-end yield; Recurring underwrites our scheduled DCA flow."
    />
  );
}

// /docs/treasury/invoices — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Invoices"
      description="OCR plus invoice intelligence."
      intro="Drop a PDF; Atlas extracts vendor, amount, due date, and a confidence score. Match against open POs, route to approvers, and pay from the treasury — no copy-paste between accounting and chain."
    />
  );
}

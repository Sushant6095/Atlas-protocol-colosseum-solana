// /docs/treasury/payment-prewarm — stub. Real content ships in the next PR.

"use client";

import { DocStub } from "@/components/docs";

export default function Page(): JSX.Element {
  return (
    <DocStub
      title="Payment pre-warm"
      description="Cashflow-aware buffer that keeps payroll on time."
      intro="Payment pre-warm watches the upcoming payment schedule and quietly liquidates yield-bearing positions just before bills are due — so payroll never bounces and the rest of capital stays at work. This page covers the budget engine and the alerts when pre-warm fires."
    />
  );
}

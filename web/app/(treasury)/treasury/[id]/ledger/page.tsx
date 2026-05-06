import { Panel } from "@/components/primitives/Panel";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return (
    <Panel surface="raised">
      <h1 className="text-display text-[20px] mb-2">Unified ledger</h1>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — deposits + rebalances + payouts + invoices in one timeline.
      </p>
    </Panel>
  );
}

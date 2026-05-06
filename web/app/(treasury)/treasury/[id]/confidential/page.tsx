import { Panel } from "@/components/primitives/Panel";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return (
    <Panel surface="raised" accent="zk">
      <h1 className="text-display text-[20px] mb-2">Confidential dashboard</h1>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — disclosure-tier-aware view: PublicAuditor → aggregate, Operator
        → per-protocol, FinanceAdmin → full (with audit-log entry per page view).
      </p>
    </Panel>
  );
}

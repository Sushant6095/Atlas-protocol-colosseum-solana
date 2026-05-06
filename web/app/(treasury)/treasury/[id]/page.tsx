import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Panel surface="raised">
      <h1 className="text-display text-[20px] mb-2">Treasury overview</h1>
      <IdentifierMono value={id} copy size="md" />
      <p className="mt-3 text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — header KPIs · current allocation · runway forecast.
      </p>
    </Panel>
  );
}

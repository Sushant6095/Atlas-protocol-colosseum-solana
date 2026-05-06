import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";

export default async function Page({
  params,
}: { params: Promise<{ id: string; hash: string }> }) {
  const { hash } = await params;
  return (
    <Panel surface="raised">
      <h1 className="text-display text-[20px] mb-2">Black-box record</h1>
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          public_input_hash
        </span>
        <IdentifierMono value={hash} copy size="sm" />
      </div>
      <p className="mt-3 text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — full black-box record viewer.
      </p>
    </Panel>
  );
}

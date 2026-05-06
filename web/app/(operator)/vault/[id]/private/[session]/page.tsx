// /vault/[id]/private/[session] — Private session viewer (Phase 18).
// Viewing-key gated; renders only with the appropriate disclosure scope.

import { Panel } from "@/components/primitives/Panel";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";

export default async function Page({
  params,
}: { params: Promise<{ id: string; session: string }> }) {
  const { session } = await params;
  return (
    <Panel surface="raised" accent="zk">
      <h1 className="text-display text-[20px] mb-2">PER session</h1>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          session_id
        </span>
        <IdentifierMono value={session} copy size="sm" />
      </div>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — viewing-key-gated session viewer; aggregate
        commitments first, full session log only with an
        ExecutionPathPostHoc / Realtime / AgentTraceOnly key.
      </p>
    </Panel>
  );
}

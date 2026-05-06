import { Panel } from "@/components/primitives/Panel";

export default function Page() {
  return (
    <Panel surface="raised">
      <h1 className="text-display text-[20px] mb-2">Create trigger</h1>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — five trigger types with gate-condition selector.
      </p>
    </Panel>
  );
}

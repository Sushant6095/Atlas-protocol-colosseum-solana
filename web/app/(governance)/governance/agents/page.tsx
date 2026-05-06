import { Panel } from "@/components/primitives/Panel";

export default function Page() {
  return (
    <Panel surface="raised">
      <h1 className="text-display text-[20px] mb-2">Scoped keepers</h1>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — Phase 15 keeper mandates · ratcheted usage · ExecutionAttestation freshness.
      </p>
    </Panel>
  );
}

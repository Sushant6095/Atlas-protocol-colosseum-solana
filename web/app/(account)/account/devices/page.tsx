import { Panel } from "@/components/primitives/Panel";

export default function Page() {
  return (
    <Panel surface="raised">
      <h1 className="text-display text-[20px] mb-2">Devices</h1>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — mobile push tokens · per-device alert filters.
      </p>
    </Panel>
  );
}

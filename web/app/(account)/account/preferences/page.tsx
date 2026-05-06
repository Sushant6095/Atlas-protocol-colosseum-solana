import { Panel } from "@/components/primitives/Panel";

export default function Page() {
  return (
    <Panel surface="raised">
      <h1 className="text-display text-[20px] mb-2">Preferences</h1>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — locale · theme (dark / light / high-contrast) · motion
        settings · QVAC opt-in toggles.
      </p>
    </Panel>
  );
}

import { Panel } from "@/components/primitives/Panel";

export default function Page() {
  return (
    <Panel surface="raised" accent="zk">
      <h1 className="text-display text-[20px] mb-2">Viewing keys</h1>
      <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
        Phase 23 — encrypted IndexedDB vault management. Unlock with your
        wallet signature + passphrase. Auto-locks after 10 min in background.
      </p>
    </Panel>
  );
}

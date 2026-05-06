import { Panel } from "@/components/primitives/Panel";

export const metadata = { title: "Live Command Center · Atlas" };

export default function Page() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-display text-[24px]">Live Command Center</h1>
        <p className="text-[12px] text-[color:var(--color-ink-tertiary)]">
          Active rebalances · proof generation timeline · settlement bus.
        </p>
      </header>
      <Panel surface="raised" density="dense" />
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/primitives/Button";
import { Panel } from "@/components/primitives/Panel";

export default function NotFound() {
  return (
    <main className="px-6 py-24">
      <Panel surface="raised" density="default" className="max-w-[640px] mx-auto text-center">
        <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
          404
        </p>
        <h1 className="text-display text-[40px] leading-[48px] mt-1 mb-4">
          Route not found
        </h1>
        <p className="text-[14px] text-[color:var(--color-ink-secondary)] mb-6">
          That surface doesn&apos;t exist yet, or you opened a deep link from a
          previous build. Try the command palette (⌘K) or one of the
          common destinations below.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/"><Button variant="primary" size="sm">Home</Button></Link>
          <Link href="/vaults"><Button variant="secondary" size="sm">Vaults</Button></Link>
          <Link href="/infra"><Button variant="ghost" size="sm">/infra</Button></Link>
          <Link href="/docs"><Button variant="ghost" size="sm">Docs</Button></Link>
        </div>
      </Panel>
    </main>
  );
}

// /infra — Public Observatory (Phase 22 §5).
// Wired to /api/v1/infra; refetches every 5s. Embeddable widgets live
// at /infra/widget/* (Phase 22 §5.3).

import { InfraGrid } from "@/components/infra/InfraGrid";

export const metadata = { title: "/infra · Atlas Public Observatory" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
            public observatory · zero auth · rate-limited per IP
          </p>
          <h1 className="text-display text-[40px] leading-[48px] mt-2">
            Plumbing as a public surface.
          </h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] text-[color:var(--color-ink-tertiary)]">
            /api/v1/infra · /infra/attribution · /freshness
          </p>
        </div>
      </header>
      <InfraGrid />
    </div>
  );
}

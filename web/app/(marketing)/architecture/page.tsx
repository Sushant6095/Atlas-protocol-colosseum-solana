// Architecture — interactive system diagram.

import { SystemDiagram } from "@/components/architecture/SystemDiagram";

export const metadata = { title: "Architecture · Atlas" };

export default function Page() {
  return (
    <div className="relative px-8 lg:px-20 py-20 lg:py-28 max-w-[1440px] mx-auto">
      {/* Spotlight glow behind the headline — keeps the page from
          feeling like a flat slab against the dark surface. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[480px] hero-spotlight pointer-events-none -z-10" />

      <header className="mb-16 max-w-[960px]">
        <p
          className="font-mono text-[12px] uppercase tracking-[0.22em]"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          atlas blueprint
        </p>
        <h1
          className="font-display font-semibold tracking-[-0.02em] leading-[1.02] mt-5
                     text-[clamp(3rem,7vw,5.5rem)]"
          style={{ color: "var(--color-ink-primary)" }}
        >
          The whole system,
          <br />
          <span className="font-serif italic" style={{ fontFamily: "var(--font-serif)" }}>
            in one view
          </span>
          .
        </h1>
        <p
          className="mt-8 font-body text-[19px] lg:text-[20px] leading-[1.55] max-w-[720px]"
          style={{ color: "var(--color-ink-secondary)" }}
        >
          On-chain programs, pipeline stages, data sources, and stores —
          laid out the way they actually run. Hover any node for purpose,
          invariants, and source files.{" "}
          <span style={{ color: "var(--color-ink-primary)" }}>Play story</span>{" "}
          walks one rebalance from quorum ingestion to mainnet settlement.
        </p>
      </header>
      <SystemDiagram />
    </div>
  );
}

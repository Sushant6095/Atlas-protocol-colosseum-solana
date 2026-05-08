"use client";

import { useMemo } from "react";
import { LogoLoop, type LogoItem } from "./LogoLoop";
import { BrandLogo } from "./BrandLogo";
import { PARTNERS, type Partner } from "./PoweredByMarquee.data";

function PartnerPill({ partner }: { partner: Partner }) {
  return (
    <span
      className="inline-flex h-14 items-center gap-3 rounded-xl border border-line-medium bg-surface-raised px-5 transition-all duration-220 hover:border-line-strong hover:bg-surface-base"
      style={{ boxShadow: `inset 0 0 0 1px ${partner.color}1f` }}
    >
      <BrandLogo
        slug={partner.slug}
        domain={partner.domain}
        name={partner.name}
        color={partner.color}
        size={32}
      />
      <span
        className="font-display text-sm font-semibold tracking-[-0.01em] whitespace-nowrap text-ink-primary"
      >
        {partner.name}
      </span>
    </span>
  );
}

export function PoweredByMarquee() {
  const logos = useMemo<LogoItem[]>(
    () =>
      PARTNERS.map((p) => ({
        node: <PartnerPill partner={p} />,
        href: p.href,
        title: p.name,
        ariaLabel: p.name,
      })),
    [],
  );

  const half = Math.ceil(logos.length / 2);
  const rowA = useMemo(() => logos.slice(0, half), [logos, half]);
  const rowB = useMemo(() => logos.slice(half), [logos, half]);

  return (
    <section className="border-t border-line-soft bg-surface-base py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-ink-tertiary">
          POWERED BY · INTEGRATED WITH
        </p>
        <h2 className="mt-6 text-center font-display text-3xl font-medium tracking-[-0.02em] text-ink-primary md:text-4xl">
          27 audited partners.
          <br />
          <span className="bg-gradient-to-r from-accent-electric via-accent-zk to-accent-proof bg-clip-text text-transparent">
            One verifiable system.
          </span>
        </h2>
      </div>

      <div className="mt-16 space-y-6">
        <LogoLoop
          logos={rowA}
          speed={70}
          direction="left"
          gap={28}
          logoHeight={56}
          fadeOut
          fadeOutColor="#06070A"
          scaleOnHover
          pauseOnHover
          ariaLabel="Atlas substrate, data, and DeFi partners"
        />
        <LogoLoop
          logos={rowB}
          speed={55}
          direction="right"
          gap={28}
          logoHeight={56}
          fadeOut
          fadeOutColor="#06070A"
          scaleOnHover
          pauseOnHover
          ariaLabel="Atlas treasury, privacy, and tooling partners"
        />
      </div>
    </section>
  );
}

// ProductSurfaceCard — landing-page card for the three Atlas
// product surfaces (Protocol / Vault / Treasury OS). Owns the
// strict typographic hierarchy + the accent-keyed hover glow.
//
// Cards live in a 3-up grid with `flex-1` and a `min-h-[420px]`
// so all three sit on the same baseline regardless of body length.
//
// Accent ladder per surface:
//   Atlas Protocol      → accent.electric
//   Atlas Vault         → accent.zk
//   Atlas Treasury OS   → accent.execute
// Anything else falls back to electric.

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/components/primitives";

export type CardAccent = "electric" | "zk" | "execute" | "proof" | "warn" | "danger";

export interface ProductSurfaceCardProps {
  eyebrow: string;
  title: string;
  body: string;
  kpiValue: string;
  kpiLabel: string;
  cta: { href: string; label: string };
  accent: CardAccent;
  className?: string;
}

const ACCENT_VAR: Record<CardAccent, string> = {
  electric: "var(--color-accent-electric)",
  zk:       "var(--color-accent-zk)",
  execute:  "var(--color-accent-execute)",
  proof:    "var(--color-accent-proof)",
  warn:     "var(--color-accent-warn)",
  danger:   "var(--color-accent-danger)",
};

const ACCENT_GLOW: Record<CardAccent, string> = {
  electric: "0 12px 32px -16px rgba(63,140,255,0.55)",
  zk:       "0 12px 32px -16px rgba(166,130,255,0.55)",
  execute:  "0 12px 32px -16px rgba(60,227,154,0.45)",
  proof:    "0 12px 32px -16px rgba(244,120,198,0.45)",
  warn:     "0 12px 32px -16px rgba(247,185,85,0.45)",
  danger:   "0 12px 32px -16px rgba(255,97,102,0.45)",
};

export function ProductSurfaceCard({
  eyebrow, title, body, kpiValue, kpiLabel, cta, accent, className,
}: ProductSurfaceCardProps): JSX.Element {
  const accentColor = ACCENT_VAR[accent];
  const accentGlow  = ACCENT_GLOW[accent];

  return (
    <article
      className={cn(
        "group relative flex-1 min-h-[420px] flex flex-col",
        "rounded-[var(--radius-lg)] border bg-[color:var(--color-surface-raised)]",
        "p-8",
        // Hover transitions only the surface treatments per the
        // brief — content opacity / scale stays static so numbers
        // don't tween on hover.
        "transition-[border-color,box-shadow,transform]",
        "duration-[var(--duration-medium)] ease-[var(--ease-glide)]",
        "hover:-translate-y-0.5",
        className,
      )}
      style={{
        // Rest border sits in line.medium; hover swaps to the card's
        // accent at 0.4 opacity via inline event so we can compose
        // the glow shadow at the same time.
        borderColor: "var(--color-line-medium)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = `color-mix(in oklab, ${accentColor} 40%, transparent)`;
        el.style.boxShadow = accentGlow;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--color-line-medium)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Eyebrow */}
      <p
        className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]"
        style={{ marginBottom: 24 }}
      >
        {eyebrow}
      </p>

      {/* Title */}
      <h3 className="font-display font-semibold text-2xl tracking-tight leading-tight text-[color:var(--color-ink-primary)]">
        {title}
      </h3>

      {/* Body */}
      <p
        className="mt-4 font-body text-sm leading-[1.6] text-[color:var(--color-ink-secondary)]"
        style={{ maxWidth: "38ch" }}
      >
        {body}
      </p>

      {/* KPI block — pushed to the bottom of the card. */}
      <div className="mt-auto pt-8 border-t border-[color:var(--color-line-soft)]">
        <p
          className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-tertiary)]"
          style={{ marginBottom: 8 }}
        >
          {kpiLabel}
        </p>
        <p
          className="font-mono font-bold text-4xl leading-none tabular-nums"
          style={{ color: accentColor }}
        >
          {kpiValue}
        </p>
      </div>

      {/* CTA */}
      <Link
        href={cta.href}
        className="mt-6 inline-flex items-center gap-1.5 font-medium text-sm text-[color:var(--color-accent-electric)]
                   transition-colors duration-[var(--duration-quick)] ease-[var(--ease-glide)]
                   hover:text-[color:var(--color-ink-primary)]"
      >
        {cta.label}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 ease-[var(--ease-glide)]
                     group-hover:translate-x-0.5"
        />
      </Link>
    </article>
  );
}

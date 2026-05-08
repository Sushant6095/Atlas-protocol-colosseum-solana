// Section — vertical-rhythm primitive for marketing surfaces.
//
// Three densities map to the three classes of section content:
//
//   cinematic — hero, trust posture, final CTA. Big breathing room.
//                 py-32 desktop, collapses to py-20 < 768px.
//   default   — pipeline ribbon, product surfaces, live feed.
//                 py-24 desktop, collapses to py-16 < 768px.
//   dense     — footer, in-section sub-bands.
//                 py-16 desktop, collapses to py-12 < 768px.
//
// Containers max out at 1280px with px-6 mobile / px-8 tablet / px-0
// desktop. The `bleed` prop opts out of the centred container for
// full-bleed banners (used by the hero spotlight).

"use client";

import { type ReactNode } from "react";
import { cn } from "@/components/primitives";

export type SectionVariant = "cinematic" | "default" | "dense";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  variant?: SectionVariant;
  /** Skip the centred max-w container — use for full-bleed surfaces. */
  bleed?: boolean;
  /** Drop the inner horizontal padding (the parent already padded). */
  flush?: boolean;
  children: ReactNode;
}

const PAD_Y: Record<SectionVariant, string> = {
  cinematic: "py-20 md:py-32",
  default:   "py-16 md:py-24",
  dense:     "py-12 md:py-16",
};

export function Section({
  variant = "default", bleed = false, flush = false, className, children, ...rest
}: SectionProps): JSX.Element {
  return (
    <section className={cn("w-full", PAD_Y[variant], className)} {...rest}>
      {bleed ? (
        children
      ) : (
        <div
          className={cn(
            "mx-auto w-full max-w-7xl",
            !flush && "px-6 md:px-8 lg:px-0",
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

// Hairline separator placed between *major* section transitions
// (cinematic ↔ default), never between every section. The brief is
// explicit: rhythm comes from spacing, not horizontal rules.
export function SectionDivider({ className }: { className?: string }): JSX.Element {
  return (
    <div className={cn("h-px w-full bg-[color:var(--color-line-soft)]", className)} aria-hidden />
  );
}

// Standard intro block — eyebrow + headline + optional subhead.
// Headline-to-content gap is `mt-12`; subhead-to-CTA gap is `mt-8`.
// Use `<SectionIntro>` instead of duplicating the boilerplate.
export interface SectionIntroProps {
  kicker?: string;
  title: ReactNode;
  subhead?: ReactNode;
  /** Right-side slot, sits opposite the headline (e.g. an open-link). */
  aside?: ReactNode;
  className?: string;
}

export function SectionIntro({
  kicker, title, subhead, aside, className,
}: SectionIntroProps): JSX.Element {
  return (
    <header className={cn("flex items-end justify-between gap-6 flex-wrap", className)}>
      <div className="max-w-[760px]">
        {kicker && (
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-tertiary)]">
            {kicker}
          </p>
        )}
        <h2 className="mt-2 font-display font-semibold tracking-tight leading-[1.05] text-[clamp(2rem,4.5vw,2.75rem)] text-[color:var(--color-ink-primary)]">
          {title}
        </h2>
        {subhead && (
          <p className="mt-4 font-body text-sm leading-[1.6] text-[color:var(--color-ink-secondary)] max-w-[60ch]">
            {subhead}
          </p>
        )}
      </div>
      {aside}
    </header>
  );
}

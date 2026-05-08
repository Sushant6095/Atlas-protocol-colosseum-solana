// Button — the only button primitive. Variants encode intent
// (primary action, secondary, ghost, destructive).
//
// Primary is the brand action — gradient zk → electric, white-text
// confidence, and a paired drop-glow that reads as "the protocol's
// own light spilling out from underneath the button." Hover deepens
// the glow and lifts 1px; active settles back. Trailing icon
// (lucide ArrowRight) gets its own transition that pulls forward
// 2px on parent hover via the `group` / `group-hover:` mechanism.
//
// Secondary stays a ghost panel — surface.raised over a line.medium
// border. No gradient, no glow.

"use client";

import { memo, forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "./cn";
import { transitions } from "@/lib/motion";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Explicit accent override — only the five tokens. */
  accent?: "electric" | "zk" | "proof" | "execute";
}

// Primary visual constants (per the brand brief). Inlined here
// rather than in tokens.ts because the gradient is intent-specific
// (the only "hero CTA" surface in the app), not a reusable color.
const PRIMARY_GRADIENT =
  "linear-gradient(135deg, #3F8CFF 0%, #5B8CFF 60%, #A682FF 100%)";
const PRIMARY_SHADOW =
  "0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 24px -8px rgba(63,140,255,0.45)";
const PRIMARY_SHADOW_HOVER =
  "0 1px 0 rgba(255,255,255,0.14) inset, 0 12px 32px -10px rgba(63,140,255,0.55)";

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8  px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  // Primary at lg uses 14px / 22px — overridden below for the
  // primary variant; secondary / ghost at lg keep this height.
  lg: "h-12 px-6 text-[16px] gap-2.5",
};

const ButtonImpl = forwardRef<HTMLButtonElement, ButtonProps>(function ButtonImpl(
  { variant = "primary", size = "md", accent, className, children, ...rest },
  ref,
) {
  if (variant === "primary") {
    // Brand CTA — gradient + paired drop-glow, fixed 14/22 padding,
    // 8px radius. Hover lifts 1px and deepens the glow.
    return (
      <motion.button
        ref={ref}
        whileTap={{ y: 0, scale: 0.99, transition: transitions.quickPress }}
        className={cn(
          "group relative inline-flex items-center justify-center font-body font-medium text-sm tracking-normal",
          "rounded-[var(--radius-md)] border",
          "text-[color:var(--color-ink-primary)]",
          // The transition covers transform, brightness, box-shadow,
          // border at the brief's 220ms / ease.glide.
          "transition-[transform,filter,box-shadow,border-color] duration-[var(--duration-medium)] ease-[var(--ease-glide)]",
          "hover:-translate-y-px hover:brightness-[1.04]",
          "active:translate-y-0 active:brightness-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-base)]",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:brightness-100",
          className,
        )}
        style={{
          padding: "14px 22px",
          background: PRIMARY_GRADIENT,
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: PRIMARY_SHADOW,
          // Hover shadow is applied via inline event for a precise
          // CSS variable swap that doesn't fight Tailwind's
          // shadow-* utility cascade.
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = PRIMARY_SHADOW_HOVER; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = PRIMARY_SHADOW; }}
        {...(rest as React.ComponentPropsWithoutRef<typeof motion.button>)}
      >
        {children}
      </motion.button>
    );
  }

  // Secondary / ghost / destructive keep tokenised surface treatments.
  const variantClass: Record<Exclude<ButtonVariant, "primary">, string> = {
    secondary:
      "bg-[color:var(--color-surface-raised)] text-[color:var(--color-ink-primary)] border border-[color:var(--color-line-medium)] hover:border-[color:var(--color-line-strong)]",
    ghost:
      "bg-transparent text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-line-soft)]",
    destructive:
      "bg-[color:var(--color-accent-danger)]/15 text-[color:var(--color-accent-danger)] border border-[color:var(--color-accent-danger)]/30 hover:bg-[color:var(--color-accent-danger)]/25",
  };

  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.98, transition: transitions.quickPress }}
      className={cn(
        "group inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium",
        "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-precise)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-base)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variantClass[variant],
        SIZE_CLASS[size],
        accent === "zk" && "ring-1 ring-[color:var(--color-accent-zk)]/40",
        accent === "proof" && "ring-1 ring-[color:var(--color-accent-proof)]/40",
        accent === "execute" && "ring-1 ring-[color:var(--color-accent-execute)]/40",
        className,
      )}
      {...(rest as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
});

export const Button = memo(ButtonImpl);
Button.displayName = "Button";

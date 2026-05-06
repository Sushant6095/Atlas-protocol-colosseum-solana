// Button — the only button primitive. Variants encode intent
// (primary action, secondary, ghost, destructive). Motion follows
// the `quickPress` token (Phase 20 §2.2).

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

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--color-accent-electric)] text-[color:var(--color-ink-inverted)] hover:bg-[color:var(--color-accent-electric)]/90",
  secondary:
    "bg-[color:var(--color-surface-raised)] text-[color:var(--color-ink-primary)] border border-[color:var(--color-line-medium)] hover:border-[color:var(--color-line-strong)]",
  ghost:
    "bg-transparent text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-line-soft)]",
  destructive:
    "bg-[color:var(--color-accent-danger)]/15 text-[color:var(--color-accent-danger)] border border-[color:var(--color-accent-danger)]/30 hover:bg-[color:var(--color-accent-danger)]/25",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8  px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-12 px-6 text-[16px] gap-2.5",
};

const ButtonImpl = forwardRef<HTMLButtonElement, ButtonProps>(function ButtonImpl(
  { variant = "primary", size = "md", accent, className, children, ...rest },
  ref,
) {
  // We use a motion.button so press feedback gets a tokenised
  // animation curve. `whileTap` collapses to nothing under reduced
  // motion via the global `prefers-reduced-motion` rule in CSS.
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.98, transition: transitions.quickPress }}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium",
        "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-precise)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-base)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANT_CLASS[variant],
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

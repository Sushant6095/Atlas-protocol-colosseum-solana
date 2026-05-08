// <Button> — primary (gradient) / ghost / danger.
//
// Primary uses the brand-CTA gradient (electric → mid → zk). Ghost
// is the secondary inline action. Danger is reserved for irreversible
// operations.

"use client";

import { forwardRef, memo, type ButtonHTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const SIZE_PAD: Record<Size, string> = {
  sm: "px-3 h-8 text-[13px] gap-1.5",
  md: "px-4 h-10 text-sm gap-2",
  lg: "px-5 h-11 text-[15px] gap-2.5",
};

const ButtonImpl = forwardRef<HTMLButtonElement, ButtonProps>(function ButtonImpl(
  { variant = "primary", size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={clsx(
        "group inline-flex items-center justify-center font-body font-medium",
        "rounded-[var(--radius-md)] border",
        "transition-[transform,filter,box-shadow,border-color]",
        "duration-[var(--duration-medium)] ease-[var(--ease-glide)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        SIZE_PAD[size],
        variant === "primary" && "hover:-translate-y-px hover:brightness-[1.04] active:translate-y-0 active:brightness-[0.98]",
        variant === "ghost"   && "hover:border-[color:var(--color-line-strong)]",
        variant === "danger"  && "hover:border-[color:var(--color-accent-danger)]",
        className,
      )}
      style={
        variant === "primary"
          ? {
              color: "var(--color-ink-primary)",
              background: "linear-gradient(135deg, #3F8CFF 0%, #5B8CFF 60%, #A682FF 100%)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.10) inset, 0 8px 24px -8px rgba(63,140,255,0.45)",
            }
          : variant === "ghost"
          ? {
              color: "var(--color-ink-primary)",
              background: "var(--color-surface-raised)",
              borderColor: "var(--color-line-medium)",
            }
          : {
              color: "var(--color-accent-danger)",
              background: "color-mix(in oklab, var(--color-accent-danger) 8%, var(--color-surface-base))",
              borderColor: "color-mix(in oklab, var(--color-accent-danger) 35%, transparent)",
            }
      }
    >
      {children}
    </button>
  );
});

export const Button = memo(ButtonImpl);
Button.displayName = "Button";

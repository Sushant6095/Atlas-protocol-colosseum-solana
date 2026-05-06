// EmptyState — every list ships one (Phase 21 §12.2).
//
// One sentence describing what would appear, the action that would
// create it, and a doc link. No bare "No data" walls.

"use client";

import Link from "next/link";
import { memo, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/components/primitives";
import { Button } from "@/components/primitives/Button";

export interface EmptyStateProps {
  /** What this list would contain. One sentence. */
  description: string;
  /** Primary CTA — typically the "create" action. Optional. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Doc link reinforcing what the list is for. */
  docHref?: string;
  /** Optional icon. */
  icon?: ReactNode;
  className?: string;
}

function EmptyStateImpl({ description, action, docHref, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-4",
        "py-16 px-6 rounded-[var(--radius-md)]",
        "border border-dashed border-[color:var(--color-line-medium)]",
        "bg-[color:var(--color-surface-sunken)]",
        className,
      )}
    >
      {icon ? (
        <div className="text-[color:var(--color-ink-tertiary)]" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className="max-w-md text-[14px] leading-[20px] text-[color:var(--color-ink-secondary)]">
        {description}
      </p>
      <div className="flex items-center gap-3">
        {action ? (
          action.href ? (
            <Link href={action.href}>
              <Button variant="primary" size="sm">
                {action.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : (
            <Button variant="primary" size="sm" onClick={action.onClick}>
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )
        ) : null}
        {docHref ? (
          <Link
            href={docHref}
            className="text-[12px] text-[color:var(--color-ink-tertiary)] underline-offset-2 hover:underline hover:text-[color:var(--color-ink-secondary)]"
          >
            read the docs
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export const EmptyState = memo(EmptyStateImpl);
EmptyState.displayName = "EmptyState";

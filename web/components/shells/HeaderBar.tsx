// Top status bar shared by every shell (Phase 21 §4).
//
// Shows: Atlas wordmark + nav anchors, realtime status pill, command
// palette hint, alert center button, account / wallet button.

"use client";

import Link from "next/link";
import { memo } from "react";
import { Bell, Command, Sparkles } from "lucide-react";
import { cn } from "@/components/primitives";
import { Button } from "@/components/primitives/Button";
import { LiveStatusPill } from "@/components/system/LiveStatusPill";
import { useUiStore } from "@/lib/ui-store";

interface HeaderBarProps {
  /** Optional in-shell nav links. */
  nav?: { label: string; href: string }[];
  /** Right-rail toggle visibility (terminal only). */
  showRightRailToggle?: boolean;
  /** Compact (32px) variant for the public shell. */
  compact?: boolean;
}

function HeaderBarImpl({ nav, showRightRailToggle, compact }: HeaderBarProps) {
  const togglePalette = useUiStore((s) => s.toggleCommandPalette);
  const toggleAlerts = useUiStore((s) => s.toggleAlertCenter);
  const toggleRightRail = useUiStore((s) => s.toggleRightRail);

  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-nav,100)] w-full",
        "flex items-center gap-4 px-6",
        "border-b border-[color:var(--color-line-soft)]",
        "bg-[color:var(--color-surface-base)]/80 backdrop-blur-xl",
        compact ? "h-10" : "h-14",
      )}
    >
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-display">
        <Sparkles className="h-4 w-4 text-[color:var(--color-accent-electric)]" />
        <span className="text-[15px]">atlas</span>
      </Link>
      {nav?.length ? (
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-[var(--radius-sm)] text-[13px]",
                "text-[color:var(--color-ink-secondary)]",
                "hover:text-[color:var(--color-ink-primary)] hover:bg-[color:var(--color-line-soft)]",
                "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-precise)]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex-1" />

      <LiveStatusPill />

      <button
        type="button"
        onClick={togglePalette}
        className={cn(
          "hidden sm:flex items-center gap-2 px-3 h-8 rounded-[var(--radius-sm)]",
          "border border-[color:var(--color-line-medium)] text-[12px]",
          "text-[color:var(--color-ink-tertiary)] hover:text-[color:var(--color-ink-primary)]",
        )}
      >
        <Command className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px]">⌘K</span>
      </button>

      <button
        type="button"
        onClick={toggleAlerts}
        aria-label="Open alert center"
        className={cn(
          "h-8 w-8 grid place-items-center rounded-[var(--radius-sm)]",
          "text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)]",
        )}
      >
        <Bell className="h-4 w-4" />
      </button>

      {showRightRailToggle ? (
        <Button variant="ghost" size="sm" onClick={toggleRightRail}>
          Toggle rail
        </Button>
      ) : null}
    </header>
  );
}

export const HeaderBar = memo(HeaderBarImpl);
HeaderBar.displayName = "HeaderBar";

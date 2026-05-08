// Top status bar shared by every shell (Phase 21 §4).
//
// Shows: Atlas wordmark + nav anchors, realtime status pill, command
// palette hint, alert center button, account / wallet button.

"use client";

import Link from "next/link";
import { memo } from "react";
import { Bell, Command } from "lucide-react";
import { PleiadesIcon, cn } from "@/components/primitives";
import { Button } from "@/components/primitives/Button";
import { WalletStatusPill } from "@/components/system/WalletStatusPill";
import { ConnectButton } from "@/components/ConnectButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProductButton } from "@/components/nav/ProductButton";
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
        "flex items-center gap-5 px-8",
        "border-b border-[color:var(--color-line-soft)]",
        "bg-[color:var(--color-surface-base)]/85 backdrop-blur-xl backdrop-saturate-150",
        compact ? "h-10" : "h-20",
      )}
    >
      <Link
        href="/"
        aria-label="Atlas — home"
        className="group flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)] rounded-[var(--radius-xs)]"
      >
        <PleiadesIcon
          className={cn(
            compact ? "h-6 w-6" : "h-9 w-9",
            "transition-transform duration-[var(--duration-quick)] ease-[var(--ease-glide)] group-hover:scale-105",
          )}
        />
        <span
          className={cn(
            "font-display font-semibold tracking-tight text-[color:var(--color-ink-primary)]",
            compact ? "text-lg" : "text-2xl",
          )}
        >
          Atlas
        </span>
      </Link>
      {!compact && <ProductButton />}
      {nav?.length ? (
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-4 py-2 rounded-[var(--radius-sm)] font-medium",
                compact ? "text-[13px]" : "text-[15px]",
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

      {/* Wallet-keyed status pill — hidden when disconnected so the
          chrome is silent until there's something worth saying. */}
      <div className="hidden sm:flex items-center mx-3">
        <WalletStatusPill />
      </div>

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

      <ThemeToggle />

      {showRightRailToggle ? (
        <Button variant="ghost" size="sm" onClick={toggleRightRail}>
          Toggle rail
        </Button>
      ) : null}

      <ConnectButton />
    </header>
  );
}

export const HeaderBar = memo(HeaderBarImpl);
HeaderBar.displayName = "HeaderBar";

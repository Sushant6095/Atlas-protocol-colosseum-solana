// <Tabs> — underlined tabs (Lulo signature). Active tab gets a 2px
// accent.electric bottom border + ink.primary text. Inactive sits in
// ink.tertiary, hover bumps to ink.secondary.

"use client";

import { memo, useEffect, useState } from "react";
import { clsx } from "clsx";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  active?: string;
  defaultActive?: string;
  onChange?: (id: string) => void;
  className?: string;
}

function TabsImpl({
  items, active: controlled, defaultActive, onChange, className,
}: TabsProps): JSX.Element {
  const [uncontrolled, setUncontrolled] = useState(defaultActive ?? items[0]?.id ?? "");
  const active = controlled ?? uncontrolled;

  useEffect(() => {
    if (controlled) return;
    if (defaultActive && defaultActive !== uncontrolled) setUncontrolled(defaultActive);
  }, [defaultActive, controlled, uncontrolled]);

  function pick(id: string): void {
    if (!controlled) setUncontrolled(id);
    onChange?.(id);
  }

  return (
    <div
      role="tablist"
      className={clsx("flex items-center gap-1 border-b", className)}
      style={{ borderColor: "var(--color-line-soft)" }}
    >
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => pick(t.id)}
            className="relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium
                       transition-colors duration-[var(--duration-quick)] ease-[var(--ease-glide)]
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)]"
            style={{
              color: on ? "var(--color-ink-primary)" : "var(--color-ink-tertiary)",
            }}
          >
            <span>{t.label}</span>
            {t.count != null && (
              <span
                className="font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: on ? "color-mix(in oklab, var(--color-accent-electric) 18%, transparent)" : "var(--color-line-soft)",
                  color: on ? "var(--color-accent-electric)" : "var(--color-ink-tertiary)",
                }}
              >
                {t.count}
              </span>
            )}
            {on && (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-[2px]"
                style={{ background: "var(--color-accent-electric)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export const Tabs = memo(TabsImpl);
Tabs.displayName = "Tabs";

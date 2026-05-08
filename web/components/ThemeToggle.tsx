// ThemeToggle — dark ↔ light mode switch.
//
// Atlas's brand is dark-native. Light mode is a chrome-only override
// (surface + ink + line tokens flip; accents preserved) for users
// who prefer it. Persisted to localStorage; applied pre-hydration
// via the inline script in `layout.tsx` so there's no flash.
//
// The toggle itself is a 28×28 ghost button with a sun / moon glyph.
// Press: opacity flicker, no scale. The mode flip is the feedback.

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/components/primitives";

type Mode = "dark" | "light";

const STORAGE_KEY = "atlas.theme";

function readMode(): Mode {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

function applyMode(mode: Mode): void {
  if (typeof document === "undefined") return;
  if (mode === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* private mode */ }
}

export function ThemeToggle({ className }: { className?: string }): JSX.Element {
  const [mode, setMode] = useState<Mode>("dark");

  // Sync with whatever the inline pre-hydration script picked.
  useEffect(() => { setMode(readMode()); }, []);

  function toggle(): void {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyMode(next);
  }

  const isLight = mode === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        "group inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)]",
        "border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-raised)]",
        "text-[color:var(--color-ink-secondary)]",
        "transition-[color,border-color,background] duration-[var(--duration-quick)] ease-[var(--ease-glide)]",
        "hover:text-[color:var(--color-ink-primary)] hover:border-[color:var(--color-line-medium)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)]",
        className,
      )}
    >
      {/* Mount both icons; cross-fade on toggle. */}
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center" aria-hidden>
        <Sun
          className={cn(
            "absolute h-3.5 w-3.5 transition-[opacity,transform]",
            "duration-[var(--duration-medium)] ease-[var(--ease-glide)]",
            isLight ? "opacity-100 scale-100" : "opacity-0 scale-90 -rotate-45",
          )}
        />
        <Moon
          className={cn(
            "absolute h-3.5 w-3.5 transition-[opacity,transform]",
            "duration-[var(--duration-medium)] ease-[var(--ease-glide)]",
            isLight ? "opacity-0 scale-90 rotate-45" : "opacity-100 scale-100",
          )}
        />
      </span>
    </button>
  );
}

/** Inline script body — drops into the <head> via `dangerouslySetInnerHTML`
 *  in the root layout to avoid a dark-then-light flash on first paint. */
export const themeBootScript = `
(function(){
  try {
    var m = localStorage.getItem("${STORAGE_KEY}");
    if (m === "light") document.documentElement.setAttribute("data-theme","light");
  } catch (e) { /* private mode */ }
})();
`.trim();

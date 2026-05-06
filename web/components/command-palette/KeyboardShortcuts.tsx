// Cross-route keyboard handler (Phase 21 §10).
//
// Wires the §10 shortcut sheet. Mounted once at the root; reads
// from the UI store and fires Next router pushes for the `g _`
// chord shortcuts (Linear / Bloomberg style).

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/lib/ui-store";

export function KeyboardShortcuts() {
  const router = useRouter();
  const toggleAlerts = useUiStore((s) => s.toggleAlertCenter);
  const toggleRail = useUiStore((s) => s.toggleRightRail);
  const setPalette = useUiStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    let lastG = 0;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      // ⌘ . — toggle right rail.
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        toggleRail();
        return;
      }
      // ⌘ / — toggle help (also opens palette pre-filtered to nav).
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      // ? — show shortcut help.
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        router.push("/docs/shortcuts" as never);
        return;
      }
      // g X chords.
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        lastG = Date.now();
        return;
      }
      if (Date.now() - lastG < 800) {
        const map: Record<string, string> = {
          v: "/vaults",
          t: "/treasury",
          i: "/intelligence",
          d: "/docs",
          r: "/rebalance/live",
          h: "/",
        };
        const target = map[e.key];
        if (target) {
          e.preventDefault();
          router.push(target as never);
          lastG = 0;
          return;
        }
      }
      // Backquote — bell flyout.
      if (e.key === "`" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleAlerts();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggleAlerts, toggleRail, setPalette]);

  return null;
}

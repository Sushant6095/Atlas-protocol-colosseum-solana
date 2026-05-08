"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MEGA_COLUMNS, MEGA_FOOTER_LINKS, type MegaColumn } from "./MegaMenu.data";

const ACCENT_BG: Record<MegaColumn["accent"], string> = {
  electric: "bg-accent-electric/[0.06] border-accent-electric/20",
  zk:       "bg-accent-zk/[0.06] border-accent-zk/20",
  proof:    "bg-accent-proof/[0.06] border-accent-proof/20",
};

const ACCENT_HEADER_BG: Record<MegaColumn["accent"], string> = {
  electric: "bg-accent-electric/15",
  zk:       "bg-accent-zk/15",
  proof:    "bg-accent-proof/15",
};

const ACCENT_TEXT: Record<MegaColumn["accent"], string> = {
  electric: "text-accent-electric",
  zk:       "text-accent-zk",
  proof:    "text-accent-proof",
};

const HOVER_TEXT: Record<MegaColumn["accent"], string> = {
  electric: "group-hover:text-accent-electric",
  zk:       "group-hover:text-accent-zk",
  proof:    "group-hover:text-accent-proof",
};

const HOVER_ICON_BG: Record<MegaColumn["accent"], string> = {
  electric: "group-hover:bg-accent-electric/15",
  zk:       "group-hover:bg-accent-zk/15",
  proof:    "group-hover:bg-accent-proof/15",
};

export function MegaMenu() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // close on outside click + Esc
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md px-3 py-2 font-body text-sm font-medium transition-colors ${
          open ? "bg-surface-raised text-ink-primary" : "text-ink-secondary hover:text-ink-primary"
        }`}
      >
        Product
        <ChevronDown className={`h-4 w-4 text-ink-tertiary transition-transform duration-220 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-surface-base/60 backdrop-blur-sm md:hidden"
            />

            <motion.div
              ref={panelRef}
              role="menu"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-[min(calc(100vw-32px),1140px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line-medium bg-surface-raised shadow-2xl"
            >
              {/* 3-card grid */}
              <div className="grid grid-cols-1 gap-px bg-line-medium md:grid-cols-3">
                {MEGA_COLUMNS.map((col) => {
                  const HeaderIcon = col.icon;
                  return (
                    <div key={col.id} className={`flex flex-col border ${ACCENT_BG[col.accent]} bg-surface-raised`}>
                      {/* card header — colored band with icon + title */}
                      <div className={`flex items-center gap-3 border-b border-line-soft p-5 ${ACCENT_HEADER_BG[col.accent]}`}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised ${ACCENT_TEXT[col.accent]}`}>
                          <HeaderIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className={`font-display text-lg font-semibold ${ACCENT_TEXT[col.accent]}`}>{col.title}</p>
                        </div>
                      </div>

                      {/* link list */}
                      <ul className="flex flex-1 flex-col p-3">
                        {col.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface-base"
                              >
                                <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface-sunken transition-colors ${HOVER_ICON_BG[col.accent]} ${ACCENT_TEXT[col.accent]}`}>
                                  <ItemIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`font-body text-sm font-semibold text-ink-primary transition-colors ${HOVER_TEXT[col.accent]}`}>
                                    {item.title}
                                  </p>
                                  <p className="mt-0.5 font-body text-xs leading-relaxed text-ink-tertiary">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* footer row — small horizontal strip of "About" links */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line-medium bg-surface-sunken px-5 py-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-tertiary">
                  ABOUT
                </span>
                <span className="text-ink-tertiary">·</span>
                {MEGA_FOOTER_LINKS.map((link, i) => {
                  const Icon = link.icon;
                  return (
                    <span key={link.href} className="flex items-center gap-2">
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 font-body text-xs text-ink-secondary transition-colors hover:bg-surface-raised hover:text-ink-primary"
                      >
                        <Icon className="h-3 w-3" />
                        {link.title}
                      </Link>
                      {i < MEGA_FOOTER_LINKS.length - 1 && <span className="text-line-soft">·</span>}
                    </span>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

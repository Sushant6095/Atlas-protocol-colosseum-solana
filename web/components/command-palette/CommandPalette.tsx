// Command palette (Phase 21 §9).
//
// Keyboard-driven, screen-reader accessible, fully memoised.
// Opens on ⌘K / Ctrl-K, fuzzy-matches across nav + actions, traps
// focus while open.

"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUiStore } from "@/lib/ui-store";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/components/primitives";
import { transitions } from "@/lib/motion";
import { BASE_ACTIONS, NAV_COMMANDS, type PaletteCommand } from "./commands";
import { viewingKeyVault } from "@/lib/viewing-keys";

function fuzzyMatch(query: string, label: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 1.0;
  if (l.includes(q)) return 0.7;
  let qi = 0;
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) qi++;
  }
  return qi === q.length ? 0.4 : 0;
}

function CommandPaletteImpl() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggleRail = useUiStore((s) => s.toggleRightRail);
  const toggleAlerts = useUiStore((s) => s.toggleAlertCenter);
  const router = useRouter();
  const session = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  // Cmd+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Focus input on open; reset on close.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setQuery("");
      setActiveIdx(0);
    }
  }, [open]);

  // Compose full command list and bind action handlers.
  const ALL_COMMANDS: PaletteCommand[] = useMemo(() => {
    const actions = BASE_ACTIONS.map((c) => {
      switch (c.id) {
        case "action.toggle-rail":
          return { ...c, invoke: toggleRail };
        case "action.toggle-alerts":
          return { ...c, invoke: () => toggleAlerts() };
        case "action.lock-vault":
          return { ...c, invoke: () => viewingKeyVault.lock() };
        default:
          return c;
      }
    });
    return [...NAV_COMMANDS, ...actions];
  }, [toggleRail, toggleAlerts]);

  // Filter + score.
  const ranked = useMemo(() => {
    return ALL_COMMANDS
      .filter((c) => visibleForSession(c, session))
      .map((c) => ({
        cmd: c,
        score: Math.max(
          fuzzyMatch(query, c.label),
          ...(c.keywords ?? []).map((k) => fuzzyMatch(query, k)),
        ),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }, [ALL_COMMANDS, query, session]);

  const navItems = ranked.filter((r) => r.cmd.kind === "nav");
  const actionItems = ranked.filter((r) => r.cmd.kind === "action");

  const flat = [...navItems, ...actionItems];
  const activeCmd = flat[activeIdx]?.cmd;

  const runCommand = useCallback(
    (cmd: PaletteCommand) => {
      setOpen(false);
      if (cmd.href) router.push(cmd.href as never);
      else cmd.invoke?.();
    },
    [router, setOpen],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeCmd) runCommand(activeCmd);
      }
    },
    [flat.length, activeCmd, runCommand, setOpen],
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: transitions.quickPress }}
            exit={{ opacity: 0, transition: transitions.quickPress }}
            className="fixed inset-0 bg-[color:var(--color-surface-base)]/60 backdrop-blur-sm z-[var(--z-commandPalette,600)]"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: transitions.mediumReveal }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: transitions.quickPress }}
            role="dialog"
            aria-label="Command palette"
            aria-modal="true"
            className={cn(
              "fixed left-1/2 -translate-x-1/2 top-[12%] z-[var(--z-commandPalette,600)]",
              "w-[680px] max-w-[92vw] rounded-[var(--radius-lg)]",
              "border border-[color:var(--color-line-strong)] surface-glass",
              "shadow-[var(--shadow-popover)]",
            )}
            onKeyDown={onKeyDown}
          >
            <div className="px-4 h-12 border-b border-[color:var(--color-line-soft)] flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
                ⌘K
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                placeholder="Jump to a route or run an action…"
                className="flex-1 bg-transparent outline-none text-[14px] text-[color:var(--color-ink-primary)] placeholder:text-[color:var(--color-ink-tertiary)]"
                aria-label="Command query"
                aria-controls="palette-listbox"
              />
            </div>
            <div
              id="palette-listbox"
              role="listbox"
              className="flex max-h-[60vh] overflow-auto scroll-area"
            >
              <CommandColumn
                title="navigation"
                items={navItems}
                activeId={activeCmd?.id}
                onSelect={runCommand}
              />
              <div className="w-px self-stretch bg-[color:var(--color-line-soft)]" />
              <CommandColumn
                title="actions"
                items={actionItems}
                activeId={activeCmd?.id}
                onSelect={runCommand}
              />
            </div>
            <footer className="px-4 h-9 border-t border-[color:var(--color-line-soft)] flex items-center justify-between text-[10px] text-[color:var(--color-ink-tertiary)] uppercase tracking-[0.06em]">
              <span>↑↓ to navigate · ↵ to run · esc to close</span>
              <span>{flat.length} results</span>
            </footer>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function visibleForSession(
  cmd: PaletteCommand,
  session: ReturnType<typeof useSession>,
): boolean {
  switch (cmd.requires) {
    case undefined:
    case "any":
    case "anonymous":
      return true;
    case "connected":
      return session.isConnected;
    case "developer":
      return session.isDeveloper;
  }
}

function CommandColumn({
  title,
  items,
  activeId,
  onSelect,
}: {
  title: string;
  items: { cmd: PaletteCommand }[];
  activeId: string | undefined;
  onSelect: (c: PaletteCommand) => void;
}) {
  return (
    <div className="flex-1 min-w-0 py-2">
      <p className="px-4 py-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
        {title}
      </p>
      <ul className="px-2">
        {items.length === 0 ? (
          <li className="px-2 py-2 text-[12px] text-[color:var(--color-ink-tertiary)]">
            no results
          </li>
        ) : (
          items.map(({ cmd }) => (
            <li key={cmd.id}>
              <button
                type="button"
                role="option"
                aria-selected={cmd.id === activeId}
                onClick={() => onSelect(cmd)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-2 py-1.5 rounded-[var(--radius-sm)]",
                  "text-left text-[13px]",
                  cmd.id === activeId
                    ? "bg-[color:var(--color-line-soft)] text-[color:var(--color-ink-primary)]"
                    : "text-[color:var(--color-ink-secondary)] hover:bg-[color:var(--color-line-soft)]",
                )}
              >
                <span className="truncate">{cmd.label}</span>
                {cmd.shortcut ? (
                  <span className="font-mono text-[10px] text-[color:var(--color-ink-tertiary)] shrink-0">
                    {cmd.shortcut}
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export const CommandPalette = memo(CommandPaletteImpl);
CommandPalette.displayName = "CommandPalette";

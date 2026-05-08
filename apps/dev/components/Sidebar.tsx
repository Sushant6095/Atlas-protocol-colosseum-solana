// Developer-portal sidebar.
//
// 280px left rail. Atlas Pleiades + "Developer Console" header,
// then navigation. Method labels (POST / GET / DELETE) render as
// coloured pills next to the endpoint name — that's the Lulo dev-
// portal signature.
//
// Section state (expanded / collapsed) is local to the sidebar;
// persisted via localStorage so a refresh keeps the user's layout.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Twitter, MessageCircle } from "lucide-react";
import { clsx } from "clsx";

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface NavLeaf {
  label: string;
  href: string;
  method?: Method;
}

interface NavGroup {
  label: string;
  href?: string;
  children?: NavLeaf[];
  defaultOpen?: boolean;
}

const NAV: NavGroup[] = [
  { label: "Your Projects",  href: "/projects" },
  { label: "Generate Transactions", defaultOpen: true, children: [
    { label: "initialize_vault", method: "POST", href: "/reference/transactions/initialize_vault" },
    { label: "deposit",          method: "POST", href: "/reference/transactions/deposit" },
    { label: "withdraw",         method: "POST", href: "/reference/transactions/withdraw" },
    { label: "rebalance",        method: "POST", href: "/reference/transactions/rebalance" },
    { label: "verify_proof",     method: "POST", href: "/reference/transactions/verify_proof" },
  ]},
  { label: "Generate Instructions", children: [
    { label: "deposit_ix",  method: "POST", href: "/reference/instructions/deposit_ix" },
    { label: "withdraw_ix", method: "POST", href: "/reference/instructions/withdraw_ix" },
  ]},
  { label: "Account", children: [
    { label: "vault_state",   method: "GET",    href: "/reference/account/vault_state" },
    { label: "share_balance", method: "GET",    href: "/reference/account/share_balance" },
    { label: "close_account", method: "DELETE", href: "/reference/account/close_account" },
  ]},
  { label: "Pool", children: [
    { label: "list_pools", method: "GET", href: "/reference/pool/list_pools" },
    { label: "pool_state", method: "GET", href: "/reference/pool/pool_state" },
  ]},
  { label: "Rates", children: [
    { label: "current_rates", method: "GET", href: "/reference/rates/current_rates" },
    { label: "historical",    method: "GET", href: "/reference/rates/historical" },
  ]},
  { label: "Referrals", children: [
    { label: "create_code", method: "POST", href: "/reference/referrals/create_code" },
    { label: "redeem",      method: "POST", href: "/reference/referrals/redeem" },
  ]},
];

const METHOD_TONE: Record<Method, string> = {
  GET:    "var(--color-accent-execute)",
  POST:   "var(--color-accent-electric)",
  PUT:    "var(--color-accent-warn)",
  DELETE: "var(--color-accent-danger)",
};

const STORAGE_KEY = "atlas.dev.sidebar-open";

export function Sidebar({
  user,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
}): JSX.Element {
  const pathname = usePathname() ?? "/";
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setOpenMap(JSON.parse(raw));
      else setOpenMap(Object.fromEntries(NAV.filter((g) => g.defaultOpen).map((g) => [g.label, true])));
    } catch { /* ignore */ }
  }, []);

  function toggle(label: string): void {
    setOpenMap((cur) => {
      const next = { ...cur, [label]: !cur[label] };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <aside
      className="shrink-0 sticky top-0 h-screen overflow-y-auto"
      style={{
        width: 280,
        background: "var(--color-surface-sunken)",
        borderRight: "1px solid var(--color-line-soft)",
      }}
    >
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <DevPleiades className="h-7 w-7" />
          <span>
            <span className="block font-display text-base font-semibold tracking-tight" style={{ color: "var(--color-ink-primary)" }}>
              Atlas Labs
            </span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-ink-tertiary)" }}>
              Developer Console
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-2" aria-label="Developer console nav">
        {NAV.map((group) => {
          if (!group.children?.length) {
            const active = group.href === pathname;
            return (
              <Link
                key={group.label}
                href={group.href ?? "#"}
                aria-current={active ? "page" : undefined}
                className="block px-3 py-2 rounded-[var(--radius-xs)] text-sm transition-colors"
                style={{
                  color: active ? "var(--color-ink-primary)" : "var(--color-ink-secondary)",
                  background: active ? "var(--color-surface-raised)" : "transparent",
                  borderLeft: active ? "1px solid var(--color-accent-electric)" : "1px solid transparent",
                }}
              >
                {group.label}
              </Link>
            );
          }
          const open = openMap[group.label] ?? false;
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => toggle(group.label)}
                className="w-full inline-flex items-center justify-between px-3 py-2 rounded-[var(--radius-xs)] text-sm transition-colors hover:text-[color:var(--color-ink-primary)]"
                style={{ color: "var(--color-ink-secondary)" }}
              >
                <span>{group.label}</span>
                {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {open && (
                <ul className="mt-1 space-y-px">
                  {group.children.map((leaf) => {
                    const active = pathname === leaf.href;
                    return (
                      <li key={leaf.href}>
                        <Link
                          href={leaf.href}
                          aria-current={active ? "page" : undefined}
                          className="flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-[var(--radius-xs)] transition-colors"
                          style={{
                            color: active ? "var(--color-ink-primary)" : "var(--color-ink-tertiary)",
                            background: active ? "var(--color-surface-raised)" : "transparent",
                          }}
                        >
                          {leaf.method && (
                            <span
                              className="font-mono text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
                              style={{
                                color: METHOD_TONE[leaf.method],
                                background: `color-mix(in oklab, ${METHOD_TONE[leaf.method]} 12%, transparent)`,
                                border: `1px solid color-mix(in oklab, ${METHOD_TONE[leaf.method]} 30%, transparent)`,
                                minWidth: 44,
                                textAlign: "center",
                              }}
                            >
                              {leaf.method}
                            </span>
                          )}
                          <span className="font-mono text-[12px]">{leaf.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t mx-3 mt-4 pt-4 pb-3 space-y-2" style={{ borderColor: "var(--color-line-soft)" }}>
        <a href="https://discord.gg/atlas" target="_blank" rel="noreferrer"
           className="flex items-center gap-2 px-3 py-1.5 text-[12px] rounded-[var(--radius-xs)] transition-colors hover:text-[color:var(--color-ink-primary)]"
           style={{ color: "var(--color-ink-tertiary)" }}>
          <MessageCircle className="h-3.5 w-3.5" /> Support
        </a>
        <a href="https://x.com/atlasprotocol" target="_blank" rel="noreferrer"
           className="flex items-center gap-2 px-3 py-1.5 text-[12px] rounded-[var(--radius-xs)] transition-colors hover:text-[color:var(--color-ink-primary)]"
           style={{ color: "var(--color-ink-tertiary)" }}>
          <Twitter className="h-3.5 w-3.5" /> Twitter <ExternalLink className="h-3 w-3 ml-auto" />
        </a>
      </div>

      {user && (
        <div className="border-t mx-3 mt-3 pt-4 pb-6 flex items-center gap-3" style={{ borderColor: "var(--color-line-soft)" }}>
          {user.image ? (
            <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <span className="h-8 w-8 rounded-full grid place-items-center font-mono text-[11px]"
                  style={{ background: "var(--color-surface-raised)", color: "var(--color-ink-secondary)" }}>
              {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate" style={{ color: "var(--color-ink-primary)" }}>{user.name ?? "Anonymous"}</p>
            <p className="text-[11px] font-mono truncate" style={{ color: "var(--color-ink-tertiary)" }}>{user.email ?? ""}</p>
          </div>
        </div>
      )}
    </aside>
  );
}

function DevPleiades({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="atlas-dev-pleiades" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A682FF" />
          <stop offset="1" stopColor="#3F8CFF" />
        </linearGradient>
      </defs>
      <g stroke="url(#atlas-dev-pleiades)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.92">
        <line x1="16" y1="4"  x2="11" y2="14" />
        <line x1="11" y1="14" x2="6"  y2="26" />
        <line x1="16" y1="4"  x2="21" y2="14" />
        <line x1="21" y1="14" x2="26" y2="26" />
        <line x1="11" y1="14" x2="16" y2="19" />
        <line x1="16" y1="19" x2="21" y2="14" />
      </g>
      <g fill="#E6EAF2">
        <circle cx="16" cy="4"  r="1.4" />
        <circle cx="11" cy="14" r="1.2" />
        <circle cx="21" cy="14" r="1.2" />
        <circle cx="16" cy="19" r="1.6" />
        <circle cx="6"  cy="26" r="1.2" />
        <circle cx="26" cy="26" r="1.2" />
      </g>
    </svg>
  );
}

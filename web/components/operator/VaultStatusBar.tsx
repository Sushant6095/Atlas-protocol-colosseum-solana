// VaultStatusBar — top status strip for the TerminalShell (Phase 23 §1).
//
// Renders: current vault chip, treasury chip, slot, defensive flag,
// alert badge, connection status, viewing-key indicator. 40px tall.

"use client";

import { memo } from "react";
import { Bell, Lock, ShieldAlert, Wifi } from "lucide-react";
import { useRealtimeStatus, useRealtimeStore } from "@/lib/realtime";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/components/primitives";
import { IdentifierMono } from "@/components/primitives/IdentifierMono";

interface VaultStatusBarProps {
  vault?: { id: string; name: string };
  treasury?: { id: string; name: string };
  defensiveMode?: boolean;
  confidentialMode?: boolean;
  privateExecution?: boolean;
}

function VaultStatusBarImpl({
  vault,
  treasury,
  defensiveMode,
  confidentialMode,
  privateExecution,
}: VaultStatusBarProps) {
  const status = useRealtimeStatus();
  const slot = useRealtimeStore(useShallow((s) => {
    const t = s.topics["stream.network"];
    if (t?.snapshot) {
      const p = t.snapshot.payload as { slot?: number } | undefined;
      return p?.slot ?? t.snapshot.slot;
    }
    return undefined;
  }));
  const alertCount = useRealtimeStore(useShallow((s) => {
    let n = 0;
    for (const k of Object.keys(s.topics)) {
      if (k.endsWith(".alert") && s.topics[k]?.snapshot) n++;
    }
    return n;
  }));

  return (
    <div className={cn(
      "h-10 px-4 flex items-center gap-4 text-[11px] font-mono",
      "border-b border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-sunken)]",
    )}>
      {vault ? (
        <Chip label="vault" value={
          <span className="flex items-center gap-2">
            <span>{vault.name}</span>
            <IdentifierMono value={vault.id} size="xs" />
          </span>
        } />
      ) : null}
      {treasury ? (
        <Chip label="treasury" value={
          <span className="flex items-center gap-2">
            <span>{treasury.name}</span>
            <IdentifierMono value={treasury.id} size="xs" />
          </span>
        } />
      ) : null}
      <Chip label="slot" value={slot != null ? slot.toLocaleString() : "—"} />

      <div className="flex-1" />

      {defensiveMode ? (
        <span className="inline-flex items-center gap-1 text-[color:var(--color-accent-warn)]">
          <ShieldAlert className="h-3.5 w-3.5" /> defensive
        </span>
      ) : null}
      {confidentialMode ? (
        <span className="inline-flex items-center gap-1 text-[color:var(--color-accent-zk)]">
          <Lock className="h-3 w-3" /> confidential
        </span>
      ) : null}
      {privateExecution ? (
        <span className="text-[color:var(--color-accent-zk)] uppercase">PER</span>
      ) : null}
      <span className="inline-flex items-center gap-1 text-[color:var(--color-ink-tertiary)]">
        <Bell className="h-3.5 w-3.5" /> {alertCount}
      </span>
      <span className={cn(
        "inline-flex items-center gap-1",
        status === "open" ? "text-[color:var(--color-accent-execute)]"
        : status === "degraded" ? "text-[color:var(--color-accent-warn)]"
        : "text-[color:var(--color-ink-tertiary)]",
      )}>
        <Wifi className="h-3.5 w-3.5" /> {status}
      </span>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]">
        {label}
      </span>
      <span className="text-[color:var(--color-ink-primary)]">{value}</span>
    </span>
  );
}

export const VaultStatusBar = memo(VaultStatusBarImpl);
VaultStatusBar.displayName = "VaultStatusBar";

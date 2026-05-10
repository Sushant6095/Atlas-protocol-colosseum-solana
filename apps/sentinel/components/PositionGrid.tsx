"use client";

import Link from "next/link";
import type { KaminoPositionMock } from "@/lib/mocks/positions";
import { PositionCard } from "./PositionCard";

interface PositionGridProps {
  positions: KaminoPositionMock[];
  loading?: boolean;
}

export function PositionGrid({ positions, loading }: PositionGridProps) {
  if (loading) {
    return (
      <ul className="grid grid-cols-1 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="h-44 animate-pulse rounded-xl"
            style={{ background: "var(--color-surface-raised)" }}
          />
        ))}
      </ul>
    );
  }

  if (positions.length === 0) {
    return (
      <div
        className="rounded-xl border p-10 text-center"
        style={{
          borderColor: "var(--color-line-medium)",
          background: "var(--color-surface-raised)",
        }}
      >
        <div
          className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: "color-mix(in oklab, var(--color-accent-zk) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--color-accent-zk) 30%, transparent)",
          }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--color-accent-zk)" }}
          />
        </div>
        <h3 className="font-semibold text-lg">No positions yet</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-tertiary)" }}>
          Open your first vault on kamino.finance to start tracking yield.
        </p>
        <Link
          href="https://kamino.finance"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            background: "var(--color-accent-execute)",
            color: "var(--color-surface-base)",
          }}
        >
          Open Kamino ↗
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4">
      {positions.map((p) => (
        <li key={p.id}>
          <PositionCard position={p} />
        </li>
      ))}
    </ul>
  );
}

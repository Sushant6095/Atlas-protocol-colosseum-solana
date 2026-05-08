// Shared a11y scaffolding (Phase 24 §1.5, §7).
//
// Every visualization component takes a `description` prop (passed
// through to `aria-describedby`) and a `dataTable` slot. When the
// caller does not supply one, the component renders a default table
// derived from its data, hidden visually but reachable via the
// "Show data table" toggle.

import { useEffect, useId, useState, type ReactNode } from "react";

export interface AriaDescribed {
  /** One-sentence description read by assistive tech. */
  description?: string;
  /** Override the default keyboard-navigable table. */
  dataTable?: ReactNode;
}

/** Hook: returns a stable id + a "show data table" toggle helper. */
export function useVizA11y(): {
  describedBy: string;
  showTable: boolean;
  toggleTable: () => void;
} {
  const id = useId().replace(/:/g, "_");
  const [showTable, setShowTable] = useState(false);
  // ESC closes the table.
  useEffect(() => {
    if (!showTable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTable(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTable]);
  return {
    describedBy: `viz-${id}`,
    showTable,
    toggleTable: () => setShowTable((s) => !s),
  };
}

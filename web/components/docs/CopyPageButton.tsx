// Top-right of every doc page. Copies the page's markdown source to
// the clipboard. Source is supplied by the page itself via the
// `markdown` prop — we don't introspect rendered DOM. Falls through
// silently if the clipboard API is denied (Safari private mode).

"use client";

import { memo, useState } from "react";
import { Clipboard, Check } from "lucide-react";
import { cn } from "@/components/primitives";

export interface CopyPageButtonProps {
  markdown: string;
  className?: string;
}

function CopyPageButtonImpl({ markdown, className }: CopyPageButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard denied */ }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1",
        "font-mono text-[11px] uppercase tracking-[0.12em]",
        "text-[color:var(--color-ink-secondary)] hover:text-[color:var(--color-ink-primary)]",
        "border-[color:var(--color-line-soft)] hover:border-[color:var(--color-line-medium)]",
        "transition-colors",
        className,
      )}
      aria-label={copied ? "Copied" : "Copy page markdown"}
      title={copied ? "Copied" : "Copy page markdown"}
    >
      {copied ? <Check className="h-3.5 w-3.5" style={{ color: "var(--color-accent-execute)" }} /> : <Clipboard className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy page"}
    </button>
  );
}

export const CopyPageButton = memo(CopyPageButtonImpl);

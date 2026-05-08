// CodeBlock — JSON / Rust / TS / shell rendered on surface.sunken
// with a copy affordance, optional line numbers, and subtle
// language tag. Keeps focus on the code; no chrome heroics.
//
// Highlighting is deliberately minimal — Atlas surfaces raw bytes
// (hashes, public inputs, ix data) more than syntax-rich code, and
// over-coloured code competes with the rest of the page.

"use client";

import { memo, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "./cn";

export interface CodeBlockProps {
  /** Source text. Children are accepted as the body too. */
  code?: string;
  children?: ReactNode;
  /** Language tag — rendered top-left as a subtle badge. */
  language?: "ts" | "tsx" | "rust" | "json" | "bash" | "http" | "sql" | "text";
  /** Show 1-based line numbers in a tertiary gutter. Default false. */
  showLineNumbers?: boolean;
  /** Pin the height; body becomes scrollable. */
  maxHeight?: number;
  /** Hide the copy button. Default false. */
  hideCopy?: boolean;
  className?: string;
}

function CodeBlockImpl({
  code, children, language = "text",
  showLineNumbers = false, maxHeight, hideCopy = false, className,
}: CodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const text = code ?? (typeof children === "string" ? children : "");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard denied — silent */ }
  }

  const lines = showLineNumbers ? text.split("\n") : null;

  return (
    <div
      className={cn(
        "relative group rounded-[var(--radius-md)] overflow-hidden",
        "bg-[color:var(--color-surface-sunken)]",
        "border border-[color:var(--color-line-soft)]",
        className,
      )}
    >
      <div className="absolute top-2.5 left-3 text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)] font-mono pointer-events-none">
        {language}
      </div>

      {!hideCopy && (
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-xs)]",
            "border border-[color:var(--color-line-soft)] bg-[color:var(--color-surface-raised)]",
            "text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-ink-tertiary)]",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-[var(--duration-quick)]",
            "hover:text-[color:var(--color-ink-primary)] hover:border-[color:var(--color-line-medium)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)]",
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "copied" : "copy"}
        </button>
      )}

      <pre
        className="overflow-auto scroll-area font-mono text-[12px] leading-[18px] text-[color:var(--color-ink-secondary)] px-4 pt-7 pb-4"
        style={maxHeight != null ? { maxHeight } : undefined}
      >
        {lines ? (
          <code className="grid grid-cols-[2.5ch_1fr] gap-x-4">
            {lines.map((line, i) => (
              <span key={i} className="contents">
                <span className="text-right text-[color:var(--color-ink-tertiary)] select-none">{i + 1}</span>
                <span className="whitespace-pre-wrap break-words">{line || " "}</span>
              </span>
            ))}
          </code>
        ) : (
          <code className="whitespace-pre-wrap break-words">{text || children}</code>
        )}
      </pre>
    </div>
  );
}

export const CodeBlock = memo(CodeBlockImpl);
CodeBlock.displayName = "CodeBlock";

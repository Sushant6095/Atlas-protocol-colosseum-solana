// <CopyButton> — tiny standalone copy affordance. Used inline next
// to mono identifiers and inside <CodeBlock>'s top-right.

"use client";

import { memo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { clsx } from "clsx";

export interface CopyButtonProps {
  value: string;
  /** ms to keep the success state. Default 1500. */
  timeout?: number;
  /** Optional aria-label. Default "Copy". */
  label?: string;
  className?: string;
  size?: number;
}

function CopyButtonImpl({
  value, timeout = 1500, label = "Copy", className, size = 14,
}: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    } catch { /* clipboard denied */ }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={clsx(
        "grid place-items-center transition-colors hover:text-[color:var(--color-ink-primary)]",
        className,
      )}
      style={{
        color: copied ? "var(--color-accent-execute)" : "var(--color-ink-tertiary)",
        width: size + 4,
        height: size + 4,
      }}
    >
      {copied ? <Check style={{ width: size, height: size }} /> : <Copy style={{ width: size, height: size }} />}
    </button>
  );
}

export const CopyButton = memo(CopyButtonImpl);
CopyButton.displayName = "CopyButton";

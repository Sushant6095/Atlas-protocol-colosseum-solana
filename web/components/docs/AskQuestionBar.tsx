// Sticky "Ask a question..." input pinned to the bottom of every
// doc page. Cmd+I focuses it; Enter or click opens the AI drawer.

"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/components/primitives";
import { AskAiDrawer } from "./AskAiDrawer";

function AskQuestionBarImpl(): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(): void {
    setSubmitted(value || undefined);
    setOpen(true);
  }

  return (
    <>
      <div
        className="sticky bottom-4 z-30 mx-auto w-full max-w-[768px] px-4"
        // Sticky in the main content column. The 16px bottom inset
        // gives the input a clear breathing room above the viewport
        // edge without visually colliding with the page footer.
      >
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-lg)] border h-14 px-4",
            "shadow-[0_12px_32px_rgba(0,0,0,0.36)]",
            "transition-[border-color,box-shadow] duration-200 ease-[var(--ease-glide)]",
            "focus-within:border-[color:var(--color-accent-electric)]",
            "focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent-electric)_25%,transparent)]",
          )}
          style={{
            background: "var(--color-surface-raised)",
            borderColor: "var(--color-line-medium)",
          }}
        >
          <Sparkles className="h-4 w-4" style={{ color: "var(--color-accent-electric)" }} />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[color:var(--color-ink-tertiary)]"
            style={{ color: "var(--color-ink-primary)" }}
          />
          <kbd
            className="font-mono text-[10px] uppercase tracking-[0.12em] rounded-[4px] border px-1.5 py-0.5"
            style={{
              borderColor: "var(--color-line-soft)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            ⌘ I
          </kbd>
        </form>
      </div>
      <AskAiDrawer open={open} onClose={() => setOpen(false)} initialPrompt={submitted} />
    </>
  );
}

export const AskQuestionBar = memo(AskQuestionBarImpl);

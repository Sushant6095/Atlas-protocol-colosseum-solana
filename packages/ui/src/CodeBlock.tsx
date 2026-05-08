// <CodeBlock> — surface.sunken pane with a language tag,
// CopyButton top-right, and minimal token-aware highlighting via
// a pure-JS highlighter so we don't pull shiki at runtime.
//
// The highlighter handles the four cases that show up in Atlas
// docs: ts/tsx, rust, json, bash. Everything else renders as-is.

"use client";

import { memo, type ReactNode } from "react";
import { clsx } from "clsx";
import { CopyButton } from "./CopyButton";

export type Language = "ts" | "tsx" | "rust" | "json" | "bash" | "http" | "sql" | "text";

export interface CodeBlockProps {
  code?: string;
  children?: ReactNode;
  language?: Language;
  showLineNumbers?: boolean;
  maxHeight?: number;
  hideCopy?: boolean;
  className?: string;
}

function CodeBlockImpl({
  code, children, language = "text", showLineNumbers = false,
  maxHeight, hideCopy = false, className,
}: CodeBlockProps): JSX.Element {
  const text = code ?? (typeof children === "string" ? children : "");
  const lines = showLineNumbers ? text.split("\n") : null;
  const highlighted = highlight(text, language);

  return (
    <div
      className={clsx("relative group rounded-[var(--radius-md)] overflow-hidden border", className)}
      style={{
        background: "var(--color-surface-sunken)",
        borderColor: "var(--color-line-soft)",
      }}
    >
      <span
        className="absolute top-2.5 left-3 font-mono text-[10px] uppercase tracking-[0.18em] pointer-events-none"
        style={{ color: "var(--color-ink-tertiary)" }}
      >
        {language}
      </span>
      {!hideCopy && (
        <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <CopyButton value={text} />
        </span>
      )}
      <pre
        className="overflow-auto font-mono text-[12px] leading-[18px] px-4 pt-7 pb-4"
        style={{ maxHeight, color: "var(--color-ink-secondary)" }}
      >
        {lines ? (
          <code className="grid grid-cols-[2.5ch_1fr] gap-x-4">
            {lines.map((line, i) => (
              <span key={i} className="contents">
                <span className="text-right select-none" style={{ color: "var(--color-ink-tertiary)" }}>
                  {i + 1}
                </span>
                <span dangerouslySetInnerHTML={{ __html: highlight(line || " ", language) }} />
              </span>
            ))}
          </code>
        ) : (
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        )}
      </pre>
    </div>
  );
}

// ─── Pure-JS highlighter ────────────────────────────────────────
// Token-aware regex pass. Not as nice as shiki, but stays under
// 2 KB and runs at zero cost on the server. Token colours map to
// Atlas accents so the highlighting reads as Atlas, not VSCode.

const T = {
  comment: "var(--color-ink-tertiary)",
  string:  "var(--color-accent-execute)",
  number:  "var(--color-accent-warn)",
  keyword: "var(--color-accent-zk)",
  fn:      "var(--color-accent-electric)",
  punct:   "var(--color-ink-secondary)",
} as const;

const KEYWORDS_TS = new Set([
  "const","let","var","function","return","if","else","for","while","import","export",
  "from","as","type","interface","class","extends","implements","new","await","async",
  "true","false","null","undefined","void","this","throw","try","catch","finally",
]);
const KEYWORDS_RUST = new Set([
  "fn","let","mut","pub","use","mod","struct","enum","impl","trait","for","in","while",
  "if","else","match","return","async","await","crate","self","Self","ref","loop","move",
  "as","where","dyn","true","false",
]);

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

function span(token: string, color: string): string {
  return `<span style="color:${color}">${escapeHtml(token)}</span>`;
}

function highlight(src: string, lang: Language): string {
  if (!src) return "";
  if (lang === "json") return highlightJson(src);
  if (lang === "bash" || lang === "http") return highlightShell(src);
  if (lang === "rust") return highlightCode(src, KEYWORDS_RUST);
  if (lang === "ts" || lang === "tsx") return highlightCode(src, KEYWORDS_TS);
  return escapeHtml(src);
}

function highlightCode(src: string, keywords: Set<string>): string {
  // tokenise by alternating scanner; each branch consumes one token type.
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);

    // line comment
    let m = /^\/\/[^\n]*/.exec(rest);
    if (m) { out.push(span(m[0], T.comment)); i += m[0].length; continue; }

    // string
    m = /^(["'`])((?:\\.|(?!\1).)*)\1/.exec(rest);
    if (m) { out.push(span(m[0], T.string)); i += m[0].length; continue; }

    // number
    m = /^-?\d+(?:\.\d+)?(?:_\d+)*(?:[eE][+-]?\d+)?/.exec(rest);
    if (m && !/[A-Za-z_]/.test(src[i - 1] ?? " ")) {
      out.push(span(m[0], T.number)); i += m[0].length; continue;
    }

    // identifier
    m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest);
    if (m) {
      const w = m[0];
      const next = src[i + w.length];
      if (keywords.has(w)) out.push(span(w, T.keyword));
      else if (next === "(") out.push(span(w, T.fn));
      else out.push(escapeHtml(w));
      i += w.length;
      continue;
    }

    // punctuation chunk
    m = /^[^\sA-Za-z_$\d"'`/\\]+/.exec(rest);
    if (m) { out.push(span(m[0], T.punct)); i += m[0].length; continue; }

    // whitespace / fallthrough
    out.push(escapeHtml(src[i] ?? ""));
    i += 1;
  }
  return out.join("");
}

function highlightJson(src: string): string {
  return src
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, `<span style="color:${T.fn}">$1</span>$2`)
    .replace(/:\s*("(?:\\.|[^"\\])*")/g, (m, s) => `: <span style="color:${T.string}">${s}</span>`)
    .replace(/:\s*(-?\d+(?:\.\d+)?)/g, `: <span style="color:${T.number}">$1</span>`)
    .replace(/\b(true|false|null)\b/g, `<span style="color:${T.keyword}">$1</span>`);
}

function highlightShell(src: string): string {
  return src
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(^|\s)(\$|#)\s/g, (m) => `<span style="color:${T.comment}">${m.trim()}</span> `)
    .replace(/\b(curl|grep|cat|ls|mkdir|rm|cp|mv|cd|pnpm|npm|yarn|bash|sh)\b/g, `<span style="color:${T.fn}">$1</span>`)
    .replace(/(--?[a-zA-Z][\w-]*)/g, `<span style="color:${T.keyword}">$1</span>`)
    .replace(/("[^"]*"|'[^']*')/g, `<span style="color:${T.string}">$1</span>`);
}

export const CodeBlock = memo(CodeBlockImpl);
CodeBlock.displayName = "CodeBlock";

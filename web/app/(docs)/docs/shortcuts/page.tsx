// /docs/shortcuts — printable keyboard cheat sheet.

"use client";

import { KEYBOARD_SHORTCUT_SHEET } from "@/components/command-palette";
import { DocPage } from "@/components/docs";

const MARKDOWN_SOURCE = `---
title: "Keyboard shortcuts"
description: "Every shortcut Atlas listens to."
---
# Keyboard shortcuts

Atlas runs keyboard-first. Press \`⌘K\` to open the palette; \`g\`
chords jump between surfaces; \`⌘ .\` toggles the right rail.
`;

export default function ShortcutsPage(): JSX.Element {
  return (
    <DocPage
      title="Keyboard shortcuts"
      description="Atlas runs keyboard-first. Here is every shortcut the app listens to."
      markdown={MARKDOWN_SOURCE}
    >
      <p>
        Press <kbd className="font-mono">⌘K</kbd> to open the palette;
        the <kbd className="font-mono">g</kbd> chord jumps between
        surfaces. <kbd className="font-mono">⌘ .</kbd> toggles the
        right rail in terminal pages.
      </p>

      <table className="not-prose w-full text-[13px] mt-6 border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: "var(--color-ink-tertiary)" }}>
            <th className="py-2 w-36">Shortcut</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {KEYBOARD_SHORTCUT_SHEET.map((row) => (
            <tr key={row.shortcut} style={{ background: "var(--color-surface-raised)" }}>
              <td className="px-3 py-2 font-mono text-[12px]" style={{ color: "var(--color-ink-primary)" }}>
                {row.shortcut}
              </td>
              <td className="px-3 py-2" style={{ color: "var(--color-ink-secondary)" }}>
                {row.label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DocPage>
  );
}

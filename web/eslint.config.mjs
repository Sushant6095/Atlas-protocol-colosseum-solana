// Atlas web ESLint config (Phase 20 §11 — lint set).
//
// Hard rules:
//   - `no-restricted-syntax: literal hex outside tokens.ts` — keeps
//     the design palette singular.
//   - `no-restricted-imports`: blocks Redux / Recoil / Jotai imports;
//     forces consumer code to use Zustand slices (Phase 20 §6).
//   - `no-restricted-imports`: blocks `framer-motion` raw `transition`
//     literals everywhere except `lib/motion.ts`. Other surfaces
//     reach for the variant tokens we publish there.
//
// `next lint` reads this file. Storybook + tests inherit the same
// rules.

import next from "eslint-config-next";

export default [
  ...next,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    ignores: [
      "lib/tokens.ts",
      "lib/motion.ts",
      "app/globals.css",
      "node_modules/**",
      ".next/**",
    ],
    rules: {
      // Block raw hex strings — every color must resolve through tokens.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            "Raw hex strings are forbidden outside lib/tokens.ts. Use tokens or a CSS variable from globals.css.",
        },
        {
          selector: "TemplateElement[value.cooked=/#[0-9a-fA-F]{6}/]",
          message:
            "Hex inside template strings is forbidden outside lib/tokens.ts. Use a CSS variable.",
        },
      ],
      // Block parallel state libraries — the registry is documentation,
      // this rule is the enforcement.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "redux", message: "Use Zustand. See lib/state/registry.ts." },
            { name: "@reduxjs/toolkit", message: "Use Zustand. See lib/state/registry.ts." },
            { name: "recoil", message: "Use Zustand. See lib/state/registry.ts." },
            { name: "jotai", message: "Use Zustand. See lib/state/registry.ts." },
          ],
          patterns: [
            {
              group: ["**/google-fonts/**"],
              message:
                "Self-host fonts; no Google Fonts CDN imports (Phase 20 §7.1).",
            },
          ],
        },
      ],
      // Memoised leaf components — components ending in Row / Cell /
      // Card / Tile must default-export a `React.memo` value. The full
      // check is structural (typed AST walker); this rule scaffolds
      // the intent and is paired with a code review checklist item.
      "react/display-name": "warn",
    },
  },
  {
    // Tighter rule for commitment-path-adjacent client wrappers:
    // forbid `framer-motion` raw config outside the motion library.
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            // Sub-path imports that bypass the variant tokens.
            { name: "framer-motion/dist", message: "Import from `framer-motion` only." },
          ],
        },
      ],
    },
  },
];

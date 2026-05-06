# Atlas Primitive Stories

Each primitive component ships with a Storybook entry. The full
Storybook config will land in Phase 21 alongside the routing stack;
this directory pre-locks the stories so the components are visually
documented from day one.

Story coverage:

| Primitive | Story file | Variants exercised |
|---|---|---|
| `Panel` | `Panel.stories.tsx` | raised / sunken / glass × default / dense / cinematic, accent variants |
| `Button` | `Button.stories.tsx` | primary / secondary / ghost / destructive × sm / md / lg, accent rings |
| `IdentifierMono` | `IdentifierMono.stories.tsx` | head/tail truncation, full, copy-to-clipboard |
| `AlertPill` | `AlertPill.stories.tsx` | every severity |
| `Tile` | `Tile.stories.tsx` | mono vs display, with hint, with accent |

Hard rules:

1. Every story renders against the dark surface background; no light-mode.
2. No story imports from `app/` — primitives are presentation-only.
3. Stories must demonstrate `prefers-reduced-motion: reduce` in a
   parallel viewport.

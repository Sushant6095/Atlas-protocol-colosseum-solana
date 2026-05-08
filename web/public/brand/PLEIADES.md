# Atlas · Pleiades Mark — Brand Brief

> Alternative logo system. The existing celestial-sphere mark
> (`atlas-mark.svg`, `atlas-wordmark.svg`) remains the default.
> Pleiades is for surfaces that want a sharper, more cryptographic feel.

---

## Concept

Most "Atlas" logos depict the Titan with a globe — the celestial sphere on his shoulders. We already have that mark. The Pleiades concept goes to a less-used corner of the myth:

> Atlas's daughters were the Pleiades — the seven stars.

That maps 1:1 onto Atlas-the-protocol, which has **seven agents** running the consensus pipeline ([Phase 01 §5](../../../docs/prompts/01-core-execution-engine.md)):

1. YieldMaximization
2. VolatilitySuppression
3. LiquidityStability
4. TailRisk
5. ExecutionEfficiency
6. ProtocolExposure
7. EmergencySentinel

The mark renders these seven agents as a stylized constellation in the form of a capital **A**.

---

## Anatomy

```
                ●  ← apex (verification point)
               / \
              /   \
          ●──●──●  ← consensus star (the brightest, central)
            /     \
           /       \
          ●         ●
           \       /
            ─ ─ ●  ─ ─  ← foundation (faint horizon line)
```

| Star position | Brand role | Color |
|---|---|---|
| Apex | Proof verification point — the moment a Groth16 proof passes | electric blue `#3F8CFF` |
| Two upper-arm | Yield-side agents (YieldMax, ExecEfficiency) | zk purple `#A682FF` |
| Center (largest) | **Consensus** — the brightest star, the resolved allocation | electric blue + white core |
| Two lower-arm | Risk-side agents (TailRisk, VolSuppress) | proof pink `#F478C6` |
| Base | The foundation — warehouse, deterministic state | execute green `#3CE39A` |

The thin horizon line below the base is dotted, rendered at 35% opacity. It hints at the stage Atlas-the-Titan stands on.

The constellation lines are thin (1.4 px stroke) with a gradient from zk-purple (top-left) to electric-blue (bottom-right), reading as the Atlas pipeline transitioning from inference (purple) to execution (blue).

---

## Files

| File | Use |
|---|---|
| [`atlas-pleiades.svg`](atlas-pleiades.svg) | Primary mark. Dark-surface variant. 64 × 64. |
| [`atlas-pleiades-light.svg`](atlas-pleiades-light.svg) | Light-surface variant (white / pale backgrounds). |
| [`atlas-pleiades-wordmark.svg`](atlas-pleiades-wordmark.svg) | Horizontal lockup: mark + ATLAS wordmark. 320 × 64. |
| [`atlas-pleiades-favicon.svg`](atlas-pleiades-favicon.svg) | Simplified 32 × 32 (5 stars, no base, no horizon). |
| [`atlas-brand-sheet.svg`](atlas-brand-sheet.svg) | Brand sheet — every variant + color tokens at one glance. |

---

## Color tokens

Sourced from the design system in [Phase 20](../../../docs/prompts/20-frontend-part-1-design-and-performance.md) `tokens.ts`.

| Token | Hex | Used for |
|---|---|---|
| `surface.base` | `#06070A` | Mark background (dark variant) |
| `accent.electric` | `#3F8CFF` | Apex + consensus + line gradient end |
| `accent.zk` | `#A682FF` | Upper-arm stars + line gradient start |
| `accent.proof` | `#F478C6` | Lower-arm stars |
| `accent.execute` | `#3CE39A` | Base star |
| `ink.primary` | `#E6EAF2` | Wordmark on dark |

Light-variant colors (for `_light.svg`):

| Token | Hex |
|---|---|
| Apex / consensus | `#0E50C7` |
| Arms (upper) | `#5A2DDB` |
| Arms (lower) | `#C72D85` |
| Base | `#1B9568` |

---

## Typography pairing

The wordmark uses **Cabinet Grotesk** (display) at weight 600, letter-spacing 0.15em, all caps. Fallback chain: General Sans → Geist → system-ui sans.

For body text adjacent to the mark, use **Geist** (or Inter Tight as fallback). For identifiers, hashes, slot numbers — anything where exact value matters — use **IBM Plex Mono**.

---

## Usage rules

**Do:**

- Reserve clear space around the mark equal to the height of the consensus star (≈ 6 px in the 64 × 64 mark).
- Render against `#06070A` (default), `#0B0D12` (raised surface), pure white `#FFFFFF`, or pure black `#000000`.
- Resize uniformly. The mark is geometric and scales cleanly down to 16 px favicon territory (use `atlas-pleiades-favicon.svg` for ≤ 32 px).
- Animate the consensus star — a slow pulse of its halo (1.5–2s ease-in-out) is on-brand.

**Do not:**

- Recolor individual stars without updating the brand sheet.
- Add additional stars (the count is meaningful — 7 agents).
- Distort the proportions of the constellation.
- Place on busy photographic backgrounds without the mark on a `surface.raised` plate behind it.
- Animate lines as a "loading spinner" — the mark is structural, not decorative.

---

## Why this and not the celestial sphere

The celestial sphere mark ([`atlas-mark.svg`](atlas-mark.svg)) is technically excellent and faithful to Atlas iconography. The reason for shipping Pleiades alongside it:

| Sphere | Pleiades |
|---|---|
| Iconic, instantly readable as "Atlas the Titan" | Less obvious mythological hook; **more unique** in the Solana ecosystem |
| Dense visual at small sizes (rings can stack) | Sparse, scales cleanly |
| Reads as "globe / earth / cartography" | Reads as "constellation / coordinates / proof points" |
| Generic to any Atlas-named project | Specific to Atlas-with-7-agents |
| Better as the pinned hero asset | Better as a UI / favicon / marketing repeat |

Use both. Sphere on the landing hero (mythological gravitas), Pleiades in operator surfaces and the favicon (system identity).

---

## Where it appears in the product

- `web/app/(marketing)/page.tsx` — landing hero corner
- `web/app/layout.tsx` — favicon link
- `web/app/(operator)/layout.tsx` — terminal shell top-bar
- `apps/web/components/Logo.tsx` — shared component, picks variant by route group
- README — referenced in the badge wall, not embedded inline (size discipline)
- Browser extension toolbar icon ([Phase 16](../../../docs/prompts/16-distribution-mobile-and-extension.md))
- iOS app launcher icon ([Phase 16](../../../docs/prompts/16-distribution-mobile-and-extension.md))
- Embeddable widget header ([Phase 17](../../../docs/prompts/17-rpc-fast-infrastructure.md), Phase 24)

---

## License

Brand assets ship under the same Apache-2.0 license as the rest of the repository. Consumers integrating Atlas via `@atlas/sdk` may use the mark to indicate "Powered by Atlas" provided no modification of the artwork.

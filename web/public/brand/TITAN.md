# Atlas · Titan Mark — Brand Brief

> **Primary mark.** Faithful to the classical Atlas iconography — the kneeling
> Titan bearing the celestial sphere overhead — rendered as a clean modern
> pictogram in the Atlas design system.

---

## Concept

The Titan **Atlas**, in the surviving Hellenistic and Roman depictions (e.g. the *Farnese Atlas*), is shown kneeling under the weight of the **celestial sphere** — the dome of stars, not the Earth. The Atlas-the-protocol mark stays loyal to that source:

- a **kneeling, symmetric figure** with both arms raised
- supporting an overhead **celestial sphere** with meridian, equator, and ecliptic
- a **bright proof point** at the apex of the sphere (the north star — the verification moment)
- a faint **horizon line** under the figure (the foundation it kneels on)

Reads instantly as "Atlas the Titan." The stable triangular base of the figure visually says *load-bearing* and *structural integrity* — exactly what the protocol claims to be.

---

## Anatomy

```
              ●            north star · proof point
            ╱─┬─╲
           │  │  │         celestial sphere (meridian + equator + ecliptic)
            ╲─┼─╱
             ╱ ╲           hands gripping sphere
            ╱   ╲
           ╱  ●  ╲          head (bowed under load)
          │       │         arms (raised, slightly bent at elbow)
           ╲─────╱          shoulders / belt
          ╱       ╲
         ╱         ╲        legs (kneeling stance, splayed outward)
        ●           ●       feet
       ─ ─ ─ ─ ─ ─ ─ ─      foundation horizon
```

| Element | Brand role |
|---|---|
| **Sphere** | The treasury. The cryptographic state. The thing Atlas bears on behalf of users. |
| **Meridian + equator + ecliptic** | Three rings = three trust gates (cryptographic + temporal + authorization, [Phase 01 §1 I-3](../../../docs/prompts/01-core-execution-engine.md)) |
| **North star** | The verification point — the moment a Groth16 proof passes |
| **Hands on sphere** | The interface between the protocol and the state it holds |
| **Bowed head** | Bears the weight without complaint — the protocol is non-custodial; the user owns the weight |
| **Kneeling stance** | Stability. Foundation. The base form is a triangle, the most structurally sound 2D shape |
| **Foundation line** | The deterministic warehouse — the audit trail under everything |

---

## Files

| File | Use |
|---|---|
| [`atlas-titan.svg`](atlas-titan.svg) | **Primary mark.** Dark-surface variant. 64 × 80. |
| [`atlas-titan-light.svg`](atlas-titan-light.svg) | Light-surface variant (white / pale backgrounds). |
| [`atlas-titan-wordmark.svg`](atlas-titan-wordmark.svg) | Horizontal lockup: mark + ATLAS wordmark. 360 × 80. |
| [`atlas-titan-favicon.svg`](atlas-titan-favicon.svg) | Simplified 32 × 40 (radically reduced detail for ≤ 32 px). |

Existing alternatives kept in the repo (do not delete):

- [`atlas-mark.svg`](atlas-mark.svg) — the celestial sphere mark (no figure).
- [`atlas-pleiades.svg`](atlas-pleiades.svg) — the seven-star constellation A (alternative, see [`PLEIADES.md`](PLEIADES.md)).

The **Titan** is the primary mark going forward. The other two are accent assets — Pleiades for terminal surfaces / favicons where minimalism wins, sphere-only for tiny inline contexts.

---

## Color tokens

Sourced from [Phase 20](../../../docs/prompts/20-frontend-part-1-design-and-performance.md) `tokens.ts`.

| Token | Hex | Used for |
|---|---|---|
| `surface.base` | `#06070A` | Mark background (dark variant) |
| `accent.electric` | `#3F8CFF` | Bottom of figure gradient · sphere strokes |
| `accent.zk` | `#A682FF` | Top of figure gradient · sphere strokes |
| `accent.proof` | `#F478C6` | Wordmark accent line |
| `ink.primary` | `#E6EAF2` | Wordmark on dark |

Light-variant analogues:

| | Hex |
|---|---|
| Figure | `#0E50C7` (bottom) → `#5A2DDB` (top) |
| Sphere strokes | same gradient |
| Wordmark | `#06070A` |

---

## Typography pairing

Wordmark uses **Cabinet Grotesk** (display) at weight 600, letter-spacing 0.18em, all caps. Fallback: General Sans → Geist → system-ui sans.

Body adjacent to mark: **Geist** (or Inter Tight). Identifiers / hashes / slot numbers: **IBM Plex Mono**.

---

## Geometry rules

The Titan mark **deliberately uses an 80-unit-tall viewBox** (64 × 80) instead of a square. The sphere occupies the top 30% of the canvas, the figure the bottom 70%. Forcing it into a square crops the foundation horizon and breaks the load-bearing visual.

For surfaces that demand a square (favicon at 32 × 32, app launcher icons, OG image squares):

- Use [`atlas-titan-favicon.svg`](atlas-titan-favicon.svg) which is rebuilt at 32 × 40 with simplified strokes.
- For 32 × 32 hard-square contexts, prefer the [Pleiades favicon](atlas-pleiades-favicon.svg).
- Do not letterbox or scale the Titan into a square — the proportions break.

---

## Usage rules

**Do:**

- Reserve clear space around the mark equal to the height of the head (≈ 7 px in the 64 × 80 mark).
- Render against `#06070A`, `#0B0D12`, pure white `#FFFFFF`, or pure black `#000000`.
- Animate the **north-star** halo with a slow pulse (1.5–2 s ease-in-out) — on-brand and signals the live proof feed.
- Allow the mark to read at 48 px or larger. Below that, switch to the favicon variant or the Pleiades mark.

**Do not:**

- Recolor individual limbs.
- Replace the celestial sphere with the Earth. The sphere is the *celestial* sphere — that is the mythological canon and the protocol meaning.
- Add a face or facial features. The figure is anonymous — Atlas is non-custodial; no curator face exists.
- Distort the kneeling proportions. The wide-stance triangular base is structural, not stylistic.
- Place on busy photographic backgrounds without a `surface.raised` plate behind it.
- Animate the figure's limbs. It is a structural mark, not a mascot.

---

## Why this mark

| Approach | Trade-off |
|---|---|
| **Celestial sphere only** ([`atlas-mark.svg`](atlas-mark.svg)) | Strong, generic to any Atlas-named project. Lacks figure → lacks "bearing weight" reading. |
| **Pleiades constellation** ([`atlas-pleiades.svg`](atlas-pleiades.svg)) | Unique, encodes the 7-agent architecture, but the mythological link is non-obvious to most viewers. |
| **Titan figure with sphere** (this) | **Faithful to the most recognized Atlas iconography.** Reads as "Atlas the Titan" instantly. Signals load-bearing infrastructure. Distinct from generic "globe" logos. |

The Titan mark is the one a CISO, a treasury operator, or a Frontier judge will see and immediately understand the metaphor — *Atlas bears the weight so you do not have to trust a curator*. That is the brand contract and the product contract in one image.

---

## Where it appears in the product

- `web/app/(marketing)/page.tsx` — **landing hero** (large, with halo glow on the north star)
- `web/app/layout.tsx` — favicon link → `atlas-titan-favicon.svg`
- `web/app/(operator)/layout.tsx` — terminal shell top-bar (compact, 24 px tall)
- `apps/web/components/Logo.tsx` — shared component, picks variant by route group
- README — referenced in the badge wall, not embedded inline
- Browser extension toolbar icon ([Phase 16](../../../docs/prompts/16-distribution-mobile-and-extension.md))
- iOS app launcher icon ([Phase 16](../../../docs/prompts/16-distribution-mobile-and-extension.md))
- Pitch deck cover slide ([Phase 25](../../../docs/prompts/25-winners-mindset-and-judging.md) demo flow)
- Submission-video end card

---

## License

Apache-2.0 with the rest of the repo. Consumers integrating Atlas via `@atlas/sdk` may use the mark to indicate "Powered by Atlas" provided no modification of the artwork.
